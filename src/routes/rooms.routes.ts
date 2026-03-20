import type { FileDb } from '../persistence/database';
import { createRoomsService } from '../services/rooms.service';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { ValidationError } from '../errors/AppError';

export function roomsRouter(db: FileDb) {
  const service = createRoomsService(db);

  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const { name, capacity, floor, amenities } = req.body ?? {};
    const room = service.createRoom({ name, capacity, floor, amenities });
    res.status(201).json(room);
  });

  router.get('/', (req: Request, res: Response) => {
    const minCapacityRaw = req.query.minCapacity;
    const amenityRaw = req.query.amenity;
    const filters: { minCapacity?: number; amenity?: string } = {};
    if (typeof minCapacityRaw === 'string') {
      const v = Number(minCapacityRaw);
      if (Number.isNaN(v)) {
        throw new ValidationError('minCapacity must be a number');
      }
      filters.minCapacity = v;
    }
    if (typeof amenityRaw === 'string') {
      filters.amenity = amenityRaw;
    }

    const rooms = service.listRooms(filters);
    res.json(rooms);
  });

  return router;
}

