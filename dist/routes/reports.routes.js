"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = reportsRouter;
const reports_service_1 = require("../services/reports.service");
const express_1 = require("express");
const AppError_1 = require("../errors/AppError");
function reportsRouter(db) {
    const service = (0, reports_service_1.createReportsService)(db);
    const router = (0, express_1.Router)();
    router.get('/room-utilization', (req, res) => {
        const from = typeof req.query.from === 'string' ? req.query.from : undefined;
        const to = typeof req.query.to === 'string' ? req.query.to : undefined;
        if (!from || !to)
            throw new AppError_1.ValidationError('from and to query parameters are required');
        const report = service.roomUtilizationReport({ from, to });
        res.json(report);
    });
    return router;
}
