import type { FileDb } from './database';

export type IdempotencyRow = {
  id: string;
  organizer_email: string;
  idempotency_key: string;
  request_hash: string;
  status: 'in_progress' | 'succeeded';
  booking_id: string | null;
  created_at: string;
  updated_at: string;
};

export function createIdempotencyRepo(db: FileDb) {
  return {
    findByOrganizerAndKey: (params: { organizerEmail: string; idempotencyKey: string }) => {
      return (
        db.state.idempotency_keys.find(
          (r) => r.organizer_email === params.organizerEmail && r.idempotency_key === params.idempotencyKey
        ) ?? null
      ) as IdempotencyRow | null;
    },

    insertInProgress: (params: {
      id: string;
      organizerEmail: string;
      idempotencyKey: string;
      requestHash: string;
    }) => {
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

    markSucceeded: (params: { organizerEmail: string; idempotencyKey: string; bookingId: string }) => {
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

