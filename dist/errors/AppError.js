"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ConflictError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    error;
    constructor(params) {
        super(params.message);
        this.statusCode = params.statusCode;
        this.error = params.error;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super({ statusCode: 400, error: 'ValidationError', message });
    }
}
exports.ValidationError = ValidationError;
class ConflictError extends AppError {
    constructor(message) {
        super({ statusCode: 409, error: 'ConflictError', message });
    }
}
exports.ConflictError = ConflictError;
class NotFoundError extends AppError {
    constructor(message) {
        super({ statusCode: 404, error: 'NotFoundError', message });
    }
}
exports.NotFoundError = NotFoundError;
