import type { FileDb } from '../persistence/database';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { createBookingRepo } from '../persistence/booking.repo';
import { createRoomRepo } from '../persistence/room.repo';
import { businessHoursBetweenHalfOpen, overlapHoursHalfOpen, parseIsoWithOffsetOrThrow } from '../utils/time';

export function createReportsService(db: FileDb) {
  const rooms = createRoomRepo(db);
  const bookings = createBookingRepo(db);

  return {
    roomUtilizationReport: (params: { from: string; to: string }) => {
      if (!params.from || !params.to) throw new ValidationError('from and to are required');

      // Validate parse + ordering (and timezone-awareness for "local time" windows).
      let fromDt: any;
      let toDt: any;
      try {
        fromDt = parseIsoWithOffsetOrThrow(params.from, 'from');
        toDt = parseIsoWithOffsetOrThrow(params.to, 'to');
      } catch (e) {
        throw new ValidationError(e instanceof Error ? e.message : 'Invalid time range');
      }

      if (fromDt.toMillis() >= toDt.toMillis()) {
        throw new ValidationError('from must be before to');
      }

      const totalBusinessHours = businessHoursBetweenHalfOpen(params.from, params.to);
      const fromUtc = fromDt.toUTC().toISO();
      const toUtc = toDt.toUTC().toISO();
      if (!fromUtc || !toUtc) throw new ValidationError('Unable to convert report range to UTC');

      const businessDenom = totalBusinessHours > 0 ? totalBusinessHours : 0;

      const allRooms = rooms.listRooms({});
      if (!allRooms.length) throw new NotFoundError('No rooms available');

      const confirmedOverlapping = bookings.listConfirmedBookingsOverlapping({
        fromUtc,
        toUtc
      });

      const totalByRoom = new Map<string, number>();
      for (const b of confirmedOverlapping) {
        const hours = overlapHoursHalfOpen(b.start_time_utc, b.end_time_utc, fromUtc, toUtc);
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

