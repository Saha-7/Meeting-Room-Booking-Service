"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingsRouter = bookingsRouter;
const bookings_service_1 = require("../services/bookings.service");
const express_1 = require("express");
const AppError_1 = require("../errors/AppError");
function bookingsRouter(db) {
    const service = (0, bookings_service_1.createBookingsService)(db);
    const router = (0, express_1.Router)();
    router.post('/', (req, res) => {
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
    router.get('/', (req, res) => {
        const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;
        const from = typeof req.query.from === 'string' ? req.query.from : undefined;
        const to = typeof req.query.to === 'string' ? req.query.to : undefined;
        const limitRaw = req.query.limit;
        const offsetRaw = req.query.offset;
        const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 20;
        const offset = typeof offsetRaw === 'string' ? Number(offsetRaw) : 0;
        if (!Number.isInteger(limit) || limit < 0)
            throw new AppError_1.ValidationError('limit must be a non-negative integer');
        if (!Number.isInteger(offset) || offset < 0)
            throw new AppError_1.ValidationError('offset must be a non-negative integer');
        const result = service.listBookings({
            roomId,
            from,
            to,
            limit,
            offset
        });
        res.json(result);
    });
    router.post('/:id/cancel', (req, res) => {
        const bookingId = req.params.id;
        const booking = service.cancelBooking({ bookingId });
        res.json(booking);
    });
    return router;
}
