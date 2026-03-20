export type IdempotencyKeyRecord = {
  organizerEmail: string;
  idempotencyKey: string;
  requestHash: string;
  status: 'in_progress' | 'succeeded';
  bookingId: string | null;
};

