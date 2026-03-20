function createBookingRepo(db) {
  return {
    insertBooking(params) {
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

    findById(id) {
      return db.state.bookings.find((b) => b.id === id) ?? null;
    },

    findConfirmedOverlappingBooking(params) {
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

    cancelBooking(id) {
      const b = db.state.bookings.find((x) => x.id === id);
      if (!b) return;
      b.status = 'cancelled';
      b.cancelled_at = new Date().toISOString();
    },

    listBookings(params) {
      let rows = [...db.state.bookings];

      if (params.roomId) {
        rows = rows.filter((b) => b.room_id === params.roomId);
      }

      if (typeof params.fromUtc === 'string' && typeof params.toUtc === 'string') {
        rows = rows.filter((b) => b.start_time_utc < params.toUtc && b.end_time_utc > params.fromUtc);
      } else if (typeof params.fromUtc === 'string') {
        rows = rows.filter((b) => b.end_time_utc > params.fromUtc);
      } else if (typeof params.toUtc === 'string') {
        rows = rows.filter((b) => b.start_time_utc < params.toUtc);
      }

      rows.sort((a, b) =>
        a.start_time_utc < b.start_time_utc ? -1 : a.start_time_utc > b.start_time_utc ? 1 : a.id.localeCompare(b.id)
      );

      const total = rows.length;
      const items = rows.slice(params.offset, params.offset + params.limit);
      return { items, total };
    },

    listConfirmedBookingsOverlapping(params) {
      return db.state.bookings.filter(
        (b) =>
          b.status === 'confirmed' && b.start_time_utc < params.toUtc && b.end_time_utc > params.fromUtc
      );
    }
  };
}

export { createBookingRepo };
