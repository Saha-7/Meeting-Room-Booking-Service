"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'NotFound',
        message: `No route matches ${req.method} ${req.path}`
    });
}
