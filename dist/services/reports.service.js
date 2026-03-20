"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportsService = createReportsService;
const AppError_1 = require("../errors/AppError");
const booking_repo_1 = require("../persistence/booking.repo");
const room_repo_1 = require("../persistence/room.repo");
const time_1 = require("../utils/time");
function createReportsService(db) {
    const rooms = (0, room_repo_1.createRoomRepo)(db);
    const bookings = (0, booking_repo_1.createBookingRepo)(db);
    return {
        roomUtilizationReport: (params) => {
            if (!params.from || !params.to)
                throw new AppError_1.ValidationError('from and to are required');
            // Validate parse + ordering (and timezone-awareness for "local time" windows).
            let fromDt;
            let toDt;
            try {
                fromDt = (0, time_1.parseIsoWithOffsetOrThrow)(params.from, 'from');
                toDt = (0, time_1.parseIsoWithOffsetOrThrow)(params.to, 'to');
            }
            catch (e) {
                throw new AppError_1.ValidationError(e instanceof Error ? e.message : 'Invalid time range');
            }
            if (fromDt.toMillis() >= toDt.toMillis()) {
                throw new AppError_1.ValidationError('from must be before to');
            }
            const totalBusinessHours = (0, time_1.businessHoursBetweenHalfOpen)(params.from, params.to);
            const fromUtc = fromDt.toUTC().toISO();
            const toUtc = toDt.toUTC().toISO();
            if (!fromUtc || !toUtc)
                throw new AppError_1.ValidationError('Unable to convert report range to UTC');
            const businessDenom = totalBusinessHours > 0 ? totalBusinessHours : 0;
            const allRooms = rooms.listRooms({});
            if (!allRooms.length)
                throw new AppError_1.NotFoundError('No rooms available');
            const confirmedOverlapping = bookings.listConfirmedBookingsOverlapping({
                fromUtc,
                toUtc
            });
            const totalByRoom = new Map();
            for (const b of confirmedOverlapping) {
                const hours = (0, time_1.overlapHoursHalfOpen)(b.start_time_utc, b.end_time_utc, fromUtc, toUtc);
                totalByRoom.set(b.room_id, (totalByRoom.get(b.room_id) ?? 0) + hours);
            }
            return allRooms.map((r) => {
                const bookedHours = totalByRoom.get(r.id) ?? 0;
                const utilizationPercent = businessDenom > 0 ? bookedHours / businessDenom : 0;
                return {
                    roomId: r.id,
                    roomName: r.name,
                    totalBookingHours: bookedHours,
                    utilizationPercent
                };
            });
        }
    };
}
