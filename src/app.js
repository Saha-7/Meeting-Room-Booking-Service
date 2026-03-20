import express from 'express';
import { roomsRouter } from './routes/rooms.routes.js';
import { bookingsRouter } from './routes/bookings.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createDb } from './persistence/database.js';

function createApp(params) {
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

export { createApp };
