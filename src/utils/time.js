import { DateTime } from 'luxon';

function parseIsoWithOffsetOrThrow(iso, fieldName) {
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) {
    throw new Error(`${fieldName} must be a valid ISO-8601 timestamp`);
  }
  if (!dt.isOffsetFixed && !dt.zoneName) {
    throw new Error(`${fieldName} must include a timezone offset`);
  }
  return dt;
}

function parseAndValidateBookingRange(params) {
  const start = parseIsoWithOffsetOrThrow(params.startTimeIso, 'startTime');
  const end = parseIsoWithOffsetOrThrow(params.endTimeIso, 'endTime');

  if (start.toMillis() >= end.toMillis()) {
    throw new Error('startTime must be before endTime');
  }

  const durationMinutes = Math.round((end.toMillis() - start.toMillis()) / 60000);
  const durationMillis = end.toMillis() - start.toMillis();
  const minMillis = 15 * 60 * 1000;
  const maxMillis = 4 * 60 * 60 * 1000;
  if (durationMillis < minMillis || durationMillis > maxMillis) {
    throw new Error('Booking duration must be between 15 minutes and 4 hours');
  }

  const startUtcIso = start.toUTC().toISO();
  const endUtcIso = end.toUTC().toISO();
  if (!startUtcIso || !endUtcIso) {
    throw new Error('Unable to convert timestamps to UTC');
  }

  const startLocal = start;
  const endLocal = end;

  const isWeekday = (d) => d.weekday >= 1 && d.weekday <= 5;
  if (!isWeekday(startLocal) || !isWeekday(endLocal)) {
    throw new Error('Bookings are allowed only Mon–Fri');
  }

  if (!startLocal.hasSame(endLocal, 'day')) {
    throw new Error('Booking must be within the same business day (Mon–Fri)');
  }

  const startHour = startLocal.hour + startLocal.minute / 60;
  const endHour = endLocal.hour + endLocal.minute / 60;
  const earliest = 8;
  const latest = 20;
  if (startHour < earliest) {
    throw new Error('Bookings are allowed only between 08:00 and 20:00');
  }
  if (endHour > latest || (endHour === latest && endLocal.second > 0)) {
    throw new Error('Bookings are allowed only between 08:00 and 20:00');
  }

  const day = startLocal.toISODate();
  if (!day) throw new Error('Unable to determine local date');

  return {
    parsed: { start, end, startUtcIso, endUtcIso },
    durationMinutes,
    startLocalDay: day
  };
}

function halfOpenOverlaps(aStart, aEnd, bStart, bEnd) {
  const aS = DateTime.fromISO(aStart, { setZone: true }).toMillis();
  const aE = DateTime.fromISO(aEnd, { setZone: true }).toMillis();
  const bS = DateTime.fromISO(bStart, { setZone: true }).toMillis();
  const bE = DateTime.fromISO(bEnd, { setZone: true }).toMillis();
  return aS < bE && aE > bS;
}

function businessHoursBetweenHalfOpen(fromIso, toIso) {
  const from = parseIsoWithOffsetOrThrow(fromIso, 'from');
  const to = parseIsoWithOffsetOrThrow(toIso, 'to');
  if (from.toMillis() >= to.toMillis()) {
    throw new Error('from must be before to');
  }

  let cursor = from.startOf('day');
  const endMs = to.toMillis();
  let totalMs = 0;

  while (cursor.toMillis() < endMs) {
    const weekday = cursor.weekday;
    if (weekday >= 1 && weekday <= 5) {
      const windowStart = cursor.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
      const windowEnd = cursor.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });

      const intervalStart = DateTime.max(windowStart, from);
      const intervalEnd = DateTime.min(windowEnd, to);

      if (intervalEnd.toMillis() > intervalStart.toMillis()) {
        totalMs += intervalEnd.toMillis() - intervalStart.toMillis();
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  return totalMs / 3600000;
}

function overlapHoursHalfOpen(aStartUtcIso, aEndUtcIso, fromUtcIso, toUtcIso) {
  const aS = DateTime.fromISO(aStartUtcIso, { setZone: true }).toMillis();
  const aE = DateTime.fromISO(aEndUtcIso, { setZone: true }).toMillis();
  const bS = DateTime.fromISO(fromUtcIso, { setZone: true }).toMillis();
  const bE = DateTime.fromISO(toUtcIso, { setZone: true }).toMillis();

  const start = Math.max(aS, bS);
  const end = Math.min(aE, bE);
  if (end <= start) return 0;
  return (end - start) / 3600000;
}

export {
  parseIsoWithOffsetOrThrow,
  parseAndValidateBookingRange,
  halfOpenOverlaps,
  businessHoursBetweenHalfOpen,
  overlapHoursHalfOpen
};
