import { Router } from 'express';
import { ValidationError } from '../errors/AppError.js';
import { createReportsService } from '../services/reports.service.js';

function reportsRouter(db) {
  const service = createReportsService(db);
  const router = Router();

  router.get('/room-utilization', (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    if (!from || !to) throw new ValidationError('from and to query parameters are required');
    const report = service.roomUtilizationReport({ from, to });
    res.json(report);
  });

  return router;
}

module.exports = { reportsRouter };
