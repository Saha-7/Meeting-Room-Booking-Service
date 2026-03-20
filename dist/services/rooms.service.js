"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoomsService = createRoomsService;
const crypto_1 = require("crypto");
const AppError_1 = require("../errors/AppError");
const room_repo_1 = require("../persistence/room.repo");
function createRoomsService(db) {
    const rooms = (0, room_repo_1.createRoomRepo)(db);
    return {
        createRoom: (params) => {
            return db.withWriteLock(() => {
                if (typeof params.name !== 'string' || params.name.trim().length === 0) {
                    throw new AppError_1.ValidationError('name is required');
                }
                if (!Number.isInteger(params.capacity) || params.capacity < 1) {
                    throw new AppError_1.ValidationError('capacity must be a positive integer (>= 1)');
                }
                if (!Number.isInteger(params.floor)) {
                    throw new AppError_1.ValidationError('floor must be an integer');
                }
                if (!Array.isArray(params.amenities) || !params.amenities.every((a) => typeof a === 'string')) {
                    throw new AppError_1.ValidationError('amenities must be an array of strings');
                }
                const existingId = rooms.findByNameCaseInsensitive(params.name);
                if (existingId) {
                    throw new AppError_1.ConflictError('Room name must be unique (case-insensitive)');
                }
                const id = (0, crypto_1.randomUUID)();
                rooms.insertRoom({
                    id,
                    name: params.name.trim(),
                    capacity: params.capacity,
                    floor: params.floor,
                    amenities: params.amenities
                });
                const created = rooms.findById(id);
                if (!created)
                    throw new AppError_1.NotFoundError('Room not found after creation');
                return createdToModel(created);
            });
        },
        listRooms: (filters) => {
            const rows = rooms.listRooms(filters);
            return rows.map(createdToModel);
        }
    };
}
function createdToModel(row) {
    return {
        id: row.id,
        name: row.name,
        capacity: row.capacity,
        floor: row.floor,
        amenities: row.amenities
    };
}
