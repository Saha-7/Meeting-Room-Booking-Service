import express from 'express';
import { roomsRouter } from './routes/rooms.routes';
import { bookingsRouter } from './routes/bookings.routes';
import { reportsRouter } from './routes/reports.routes';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';
import { createDb, type FileDb } from './persistence/database';

export function createApp(params?: { db?: FileDb; dbPath?: string }) {
  const app = express();

  const db =
    params?.db ??
    createDb(params?.dbPath ?? (process.env.DB_PATH ?? './meeting-room-booking.json'));

  app.use(express.json({ limit: '1mb' }));

  app.use('/rooms', roomsRouter(db));
  app.use('/bookings', bookingsRouter(db));
  app.use('/reports', reportsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

