"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const rooms_routes_1 = require("./routes/rooms.routes");
const bookings_routes_1 = require("./routes/bookings.routes");
const reports_routes_1 = require("./routes/reports.routes");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const errorHandler_1 = require("./middleware/errorHandler");
const database_1 = require("./persistence/database");
function createApp(params) {
    const app = (0, express_1.default)();
    const db = params?.db ??
        (0, database_1.createDb)(params?.dbPath ?? (process.env.DB_PATH ?? './meeting-room-booking.json'));
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use('/rooms', (0, rooms_routes_1.roomsRouter)(db));
    app.use('/bookings', (0, bookings_routes_1.bookingsRouter)(db));
    app.use('/reports', (0, reports_routes_1.reportsRouter)(db));
    app.use(notFoundHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
