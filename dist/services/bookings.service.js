"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingsService = createBookingsService;
const crypto_1 = require("crypto");
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
const luxon_1 = require("luxon");
const AppError_1 = require("../errors/AppError");
const booking_repo_1 = require("../persistence/booking.repo");
const idempotency_repo_1 = require("../persistence/idempotency.repo");
const room_repo_1 = require("../persistence/room.repo");
const time_1 = require("../utils/time");
function createBookingsService(db) {
    const bookings = (0, booking_repo_1.createBookingRepo)(db);
    const rooms = (0, room_repo_1.createRoomRepo)(db);
    const idempotency = (0, idempotency_repo_1.createIdempotencyRepo)(db);
    return {
        createBookingIdempotent: (params) => {
            if (!params.idempotencyKey || typeof params.idempotencyKey !== 'string') {
                throw new AppError_1.ValidationError('Idempotency-Key header is required');
            }
            if (typeof params.title !== 'string' || params.title.trim().length === 0) {
                throw new AppError_1.ValidationError('title is required');
            }
            if (typeof params.organizerEmail !== 'string' || params.organizerEmail.trim().length === 0) {
                throw new AppError_1.ValidationError('organizerEmail is required');
            }
            const roomId = String(params.roomId);
            // Parse + validate outside the write transaction to keep lock time small.
            let range;
            try {
                range = (0, time_1.parseAndValidateBookingRange)({
                    startTimeIso: params.startTime,
                    endTimeIso: params.endTime
                });
            }
            catch (e) {
                throw new AppError_1.ValidationError(e instanceof Error ? e.message : 'Invalid time range');
            }
            const room = rooms.findById(roomId);
            if (!room)
                throw new AppError_1.NotFoundError('Unknown room');
            const requestHash = (0, json_stable_stringify_1.default)({
                roomId,
                title: params.title,
                organizerEmail: params.organizerEmail,
                startTime: params.startTime,
                endTime: params.endTime
            });
            if (!requestHash)
                throw new AppError_1.ValidationError('Unable to build idempotency request hash');
            // Simple concurrency approach for the file-backed store:
            // - Serialize the create+idempotency workflow with `withWriteLock`.
            // - This ensures we never create duplicates even under concurrent requests.
            return db.withWriteLock(() => {
                const existing = idempotency.findByOrganizerAndKey({
                    organizerEmail: params.organizerEmail,
                    idempotencyKey: params.idempotencyKey
                });
                if (!existing) {
                    // First use: create idempotency record, then attempt to create booking.
                    idempotency.insertInProgress({
                        id: (0, crypto_1.randomUUID)(),
                        organizerEmail: params.organizerEmail,
                        idempotencyKey: params.idempotencyKey,
                        requestHash
                    });
                    const conflict = bookings.findConfirmedOverlappingBooking({
                        roomId,
                        startTimeUtc: range.parsed.startUtcIso,
                        endTimeUtc: range.parsed.endUtcIso
                    });
                    if (conflict) {
                        throw new AppError_1.ConflictError('Booking overlaps with an existing confirmed booking');
                    }
                    const bookingId = (0, crypto_1.randomUUID)();
                    bookings.insertBooking({
                        id: bookingId,
                        roomId,
                        title: params.title.trim(),
                        organizerEmail: params.organizerEmail.trim(),
                        startTimeUtc: range.parsed.startUtcIso,
                        endTimeUtc: range.parsed.endUtcIso,
                        status: 'confirmed'
                    });
                    idempotency.markSucceeded({
                        organizerEmail: params.organizerEmail,
                        idempotencyKey: params.idempotencyKey,
                        bookingId
                    });
                    const created = bookings.findById(bookingId);
                    if (!created)
                        throw new AppError_1.NotFoundError('Booking not found after creation');
                    return bookingRowToModel(created);
                }
                // Key already exists: require identical request body.
                if (existing.request_hash !== requestHash) {
                    throw new AppError_1.ConflictError('Idempotency-Key already used with a different request');
                }
                if (existing.status === 'succeeded' && existing.booking_id) {
                    const booking = bookings.findById(existing.booking_id);
                    if (!booking)
                        throw new AppError_1.NotFoundError('Idempotency booking reference not found');
                    return bookingRowToModel(booking);
                }
                // With `BEGIN IMMEDIATE`, this should rarely happen. Still handle explicitly.
                throw new AppError_1.ConflictError('Idempotency request is currently in progress');
            });
        },
        listBookings: (params) => {
            let fromUtcIso;
            let toUtcIso;
            const parseIsoToUtc = (iso, field) => {
                const dt = luxon_1.DateTime.fromISO(iso, { setZone: true });
                if (!dt.isValid)
                    throw new AppError_1.ValidationError(`${field} must be a valid ISO-8601 timestamp`);
                const isoUtc = dt.toUTC().toISO();
                if (!isoUtc)
                    throw new AppError_1.ValidationError(`Unable to convert ${field} to UTC`);
                return isoUtc;
            };
            if (params.from)
                fromUtcIso = parseIsoToUtc(params.from, 'from');
            if (params.to)
                toUtcIso = parseIsoToUtc(params.to, 'to');
            if (fromUtcIso && toUtcIso) {
                const fromMs = luxon_1.DateTime.fromISO(fromUtcIso).toMillis();
                const toMs = luxon_1.DateTime.fromISO(toUtcIso).toMillis();
                if (fromMs >= toMs)
                    throw new AppError_1.ValidationError('from must be before to');
            }
            const { items, total } = bookings.listBookings({
                roomId: params.roomId,
                fromUtc: fromUtcIso,
                toUtc: toUtcIso,
                limit: params.limit,
                offset: params.offset
            });
            return {
                items: items.map(bookingRowToModel),
                total,
                limit: params.limit,
                offset: params.offset
            };
        },
        cancelBooking: (params) => {
            return db.withWriteLock(() => {
                const existing = bookings.findById(params.bookingId);
                if (!existing)
                    throw new AppError_1.NotFoundError('Unknown booking');
                if (existing.status === 'cancelled') {
                    return bookingRowToModel(existing);
                }
                const startMs = new Date(existing.start_time_utc).getTime();
                const cutoffMs = startMs - 60 * 60 * 1000;
                const nowMs = Date.now();
                if (nowMs > cutoffMs) {
                    throw new AppError_1.ValidationError('Cancellation is allowed only until 1 hour before startTime');
                }
                bookings.cancelBooking(existing.id);
                const updated = bookings.findById(existing.id);
                if (!updated)
                    throw new AppError_1.NotFoundError('Booking not found after cancellation');
                return bookingRowToModel(updated);
            });
        }
    };
}
function bookingRowToModel(row) {
    return {
        id: row.id,
        roomId: row.room_id,
        title: row.title,
        organizerEmail: row.organizer_email,
        startTime: row.start_time_utc,
        endTime: row.end_time_utc,
        status: row.status
    };
}
