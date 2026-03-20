function createIdempotencyRepo(db) {
  return {
    findByOrganizerAndKey(params) {
      return (
        db.state.idempotency_keys.find(
          (r) => r.organizer_email === params.organizerEmail && r.idempotency_key === params.idempotencyKey
        ) ?? null
      );
    },

    insertInProgress(params) {
      db.state.idempotency_keys.push({
        id: params.id,
        organizer_email: params.organizerEmail,
        idempotency_key: params.idempotencyKey,
        request_hash: params.requestHash,
        status: 'in_progress',
        booking_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    markSucceeded(params) {
      const row = db.state.idempotency_keys.find(
        (r) => r.organizer_email === params.organizerEmail && r.idempotency_key === params.idempotencyKey
      );
      if (!row) return;
      row.status = 'succeeded';
      row.booking_id = params.bookingId;
      row.updated_at = new Date().toISOString();
    }
  };
}

export { createIdempotencyRepo };
