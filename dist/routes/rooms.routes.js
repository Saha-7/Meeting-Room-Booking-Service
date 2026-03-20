"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = roomsRouter;
const rooms_service_1 = require("../services/rooms.service");
const express_1 = require("express");
const AppError_1 = require("../errors/AppError");
function roomsRouter(db) {
    const service = (0, rooms_service_1.createRoomsService)(db);
    const router = (0, express_1.Router)();
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
                throw new AppError_1.ValidationError('minCapacity must be a number');
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
