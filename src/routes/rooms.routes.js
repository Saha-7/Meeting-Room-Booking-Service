import { Router } from 'express';
import { ValidationError } from '../errors/AppError.js';
import { createRoomsService } from '../services/rooms.service.js';

function roomsRouter(db) {
  const service = createRoomsService(db);
  const router = Router();

  router.post('/', (req, res) => {
    const { name, capacity, floor, amenities } = req.body ?? {};
    const room = service.createRoom({ name, capacity, floor, amenities });
    res.status(201).json(room);
  });

  router.get('/', (req, res) => {
    const minCapacityRaw = req.query.minCapacity;
    const amenityRaw = req.query.amenity;
    const filters = {};
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

module.exports = { roomsRouter };
