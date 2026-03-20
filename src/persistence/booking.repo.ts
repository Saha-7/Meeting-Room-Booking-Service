import type { FileDb } from './database';

export type BookingRow = {
  id: string;
  room_id: string;
  title: string;
  organizer_email: string;
  start_time_utc: string;
  end_time_utc: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
};

export function createBookingRepo(db: FileDb) {
  return {
    insertBooking: (params: {
      id: string;
      roomId: string;
      title: string;
      organizerEmail: string;
      startTimeUtc: string;
      endTimeUtc: string;
      status: 'confirmed' | 'cancelled';
    }) => {
      db.state.bookings.push({
        id: params.id,
        room_id: params.roomId,
        title: params.title,
        organizer_email: params.organizerEmail,
        start_time_utc: params.startTimeUtc,
        end_time_utc: params.endTimeUtc,
        status: params.status,
        created_at: new Date().toISOString(),
        cancelled_at: params.status === 'cancelled' ? new Date().toISOString() : null
      });
    },

    findById: (id: string): BookingRow | null => {
      return (db.state.bookings.find((b) => b.id === id) ?? null) as BookingRow | null;
    },

    findConfirmedOverlappingBooking: (params: {
      roomId: string;
      startTimeUtc: string;
      endTimeUtc: string;
    }) => {
      // Half-open interval overlap: [aStart, aEnd) overlaps [bStart, bEnd) iff:
      // aStart < bEnd AND aEnd > bStart
      const aStart = params.startTimeUtc;
      const aEnd = params.endTimeUtc;
      return (
        db.state.bookings.find((b) => {
          if (b.room_id !== params.roomId) return false;
          if (b.status !== 'confirmed') return false;
          return b.start_time_utc < aEnd && b.end_time_utc > aStart;
        })?.id ?? null
      );
    },

    cancelBooking: (id: string) => {
      const b = db.state.bookings.find((x) => x.id === id);
      if (!b) return;
      b.status = 'cancelled';
      b.cancelled_at = new Date().toISOString();
    },

    listBookings: (params: {
      roomId?: string;
      fromUtc?: string;
      toUtc?: string;
      limit: number;
      offset: number;
    }) => {
      let rows = [...db.state.bookings] as BookingRow[];

      if (params.roomId) {
        rows = rows.filter((b) => b.room_id === params.roomId);
      }

      // Time-range filter uses half-open overlap semantics:
      // include booking if it overlaps query interval [fromUtc, toUtc)
      if (typeof params.fromUtc === 'string' && typeof params.toUtc === 'string') {
        rows = rows.filter((b) => b.start_time_utc < params.toUtc! && b.end_time_utc > params.fromUtc!);
      } else if (typeof params.fromUtc === 'string') {
        rows = rows.filter((b) => b.end_time_utc > params.fromUtc!);
      } else if (typeof params.toUtc === 'string') {
        rows = rows.filter((b) => b.start_time_utc < params.toUtc!);
      }

      rows.sort((a, b) => (a.start_time_utc < b.start_time_utc ? -1 : a.start_time_utc > b.start_time_utc ? 1 : a.id.localeCompare(b.id)));

      const total = rows.length;
      const items = rows.slice(params.offset, params.offset + params.limit);
      return { items, total };
    },

    listConfirmedBookingsOverlapping: (params: { fromUtc: string; toUtc: string }) => {
      return (db.state.bookings as BookingRow[]).filter((b) => {
        return (
          b.status === 'confirmed' &&
          b.start_time_utc < params.toUtc &&
          b.end_time_utc > params.fromUtc
        );
      });
    }
  };
}

