"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppError_1 = require("../errors/AppError");
function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            error: err.error,
            message: err.message
        });
        return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({
        error: 'InternalServerError',
        message: 'Unexpected error'
    });
}
