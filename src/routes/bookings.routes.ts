import type { FileDb } from '../persistence/database';
import { createBookingsService } from '../services/bookings.service';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError';

export function bookingsRouter(db: FileDb) {
  const service = createBookingsService(db);

  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const idempotencyKey = req.header('Idempotency-Key') ?? '';
    const { roomId, title, organizerEmail, startTime, endTime } = req.body ?? {};
    const booking = service.createBookingIdempotent({
      roomId,
      title,
      organizerEmail,
      startTime,
      endTime,
      idempotencyKey
    });
    res.status(201).json(booking);
  });

  router.get('/', (req: Request, res: Response) => {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;

    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;

    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 20;
    const offset = typeof offsetRaw === 'string' ? Number(offsetRaw) : 0;

    if (!Number.isInteger(limit) || limit < 0) throw new ValidationError('limit must be a non-negative integer');
    if (!Number.isInteger(offset) || offset < 0) throw new ValidationError('offset must be a non-negative integer');

    const result = service.listBookings({
      roomId,
      from,
      to,
      limit,
      offset
    });

    res.json(result);
  });

  router.post('/:id/cancel', (req: Request, res: Response) => {
    const bookingId = req.params.id;
    const booking = service.cancelBooking({ bookingId });
    res.json(booking);
  });

  return router;
}

