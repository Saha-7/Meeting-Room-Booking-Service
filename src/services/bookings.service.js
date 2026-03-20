import { randomUUID } from 'crypto';
import stringify from 'json-stable-stringify';
import { DateTime } from 'luxon';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { createBookingRepo } from '../persistence/booking.repo.js';
import { createIdempotencyRepo } from '../persistence/idempotency.repo.js';
import { createRoomRepo } from '../persistence/room.repo.js';
import { parseAndValidateBookingRange } from '../utils/time.js';

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

function createBookingsService(db) {
  const bookings = createBookingRepo(db);
  const rooms = createRoomRepo(db);
  const idempotency = createIdempotencyRepo(db);

  return {
    createBookingIdempotent(params) {
      if (!params.idempotencyKey || typeof params.idempotencyKey !== 'string') {
        throw new ValidationError('Idempotency-Key header is required');
      }
      if (typeof params.title !== 'string' || params.title.trim().length === 0) {
        throw new ValidationError('title is required');
      }
      if (typeof params.organizerEmail !== 'string' || params.organizerEmail.trim().length === 0) {
        throw new ValidationError('organizerEmail is required');
      }

      const roomId = String(params.roomId);

      let range;
      try {
        range = parseAndValidateBookingRange({
          startTimeIso: params.startTime,
          endTimeIso: params.endTime
        });
      } catch (e) {
        throw new ValidationError(e instanceof Error ? e.message : 'Invalid time range');
      }

      const room = rooms.findById(roomId);
      if (!room) throw new NotFoundError('Unknown room');

      const requestHash = stringify({
        roomId,
        title: params.title,
        organizerEmail: params.organizerEmail,
        startTime: params.startTime,
        endTime: params.endTime
      });
      if (!requestHash) throw new ValidationError('Unable to build idempotency request hash');

      return db.withWriteLock(() => {
        const existing = idempotency.findByOrganizerAndKey({
          organizerEmail: params.organizerEmail,
          idempotencyKey: params.idempotencyKey
        });

        if (!existing) {
          idempotency.insertInProgress({
            id: randomUUID(),
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
            throw new ConflictError('Booking overlaps with an existing confirmed booking');
          }

          const bookingId = randomUUID();
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
          if (!created) throw new NotFoundError('Booking not found after creation');

          return bookingRowToModel(created);
        }

        if (existing.request_hash !== requestHash) {
          throw new ConflictError('Idempotency-Key already used with a different request');
        }

        if (existing.status === 'succeeded' && existing.booking_id) {
          const booking = bookings.findById(existing.booking_id);
          if (!booking) throw new NotFoundError('Idempotency booking reference not found');
          return bookingRowToModel(booking);
        }

        throw new ConflictError('Idempotency request is currently in progress');
      });
    },

    listBookings(params) {
      let fromUtcIso;
      let toUtcIso;

      const parseIsoToUtc = (iso, field) => {
        const dt = DateTime.fromISO(iso, { setZone: true });
        if (!dt.isValid) throw new ValidationError(`${field} must be a valid ISO-8601 timestamp`);
        const isoUtc = dt.toUTC().toISO();
        if (!isoUtc) throw new ValidationError(`Unable to convert ${field} to UTC`);
        return isoUtc;
      };

      if (params.from) fromUtcIso = parseIsoToUtc(params.from, 'from');
      if (params.to) toUtcIso = parseIsoToUtc(params.to, 'to');

      if (fromUtcIso && toUtcIso) {
        const fromMs = DateTime.fromISO(fromUtcIso).toMillis();
        const toMs = DateTime.fromISO(toUtcIso).toMillis();
        if (fromMs >= toMs) throw new ValidationError('from must be before to');
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

    cancelBooking(params) {
      return db.withWriteLock(() => {
        const existing = bookings.findById(params.bookingId);
        if (!existing) throw new NotFoundError('Unknown booking');
        if (existing.status === 'cancelled') {
          return bookingRowToModel(existing);
        }

        const startMs = new Date(existing.start_time_utc).getTime();
        const cutoffMs = startMs - 60 * 60 * 1000;
        const nowMs = Date.now();

        if (nowMs > cutoffMs) {
          throw new ValidationError('Cancellation is allowed only until 1 hour before startTime');
        }

        bookings.cancelBooking(existing.id);
        const updated = bookings.findById(existing.id);
        if (!updated) throw new NotFoundError('Booking not found after cancellation');
        return bookingRowToModel(updated);
      });
    }
  };
}

export { createBookingsService };
