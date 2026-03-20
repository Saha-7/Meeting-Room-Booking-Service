import { randomUUID } from 'crypto';
import { ConflictError, ValidationError, NotFoundError } from '../errors/AppError.js';
import { createRoomRepo } from '../persistence/room.repo.js';

function createdToModel(row) {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    floor: row.floor,
    amenities: row.amenities
  };
}

function createRoomsService(db) {
  const rooms = createRoomRepo(db);

  return {
    createRoom(params) {
      return db.withWriteLock(() => {
        if (typeof params.name !== 'string' || params.name.trim().length === 0) {
          throw new ValidationError('name is required');
        }
        if (!Number.isInteger(params.capacity) || params.capacity < 1) {
          throw new ValidationError('capacity must be a positive integer (>= 1)');
        }
        if (!Number.isInteger(params.floor)) {
          throw new ValidationError('floor must be an integer');
        }
        if (!Array.isArray(params.amenities) || !params.amenities.every((a) => typeof a === 'string')) {
          throw new ValidationError('amenities must be an array of strings');
        }

        const existingId = rooms.findByNameCaseInsensitive(params.name);
        if (existingId) {
          throw new ConflictError('Room name must be unique (case-insensitive)');
        }

        const id = randomUUID();
        rooms.insertRoom({
          id,
          name: params.name.trim(),
          capacity: params.capacity,
          floor: params.floor,
          amenities: params.amenities
        });

        const created = rooms.findById(id);
        if (!created) throw new NotFoundError('Room not found after creation');
        return createdToModel(created);
      });
    },

    listRooms(filters) {
      const rows = rooms.listRooms(filters);
      return rows.map(createdToModel);
    }
  };
}

export { createRoomsService };
