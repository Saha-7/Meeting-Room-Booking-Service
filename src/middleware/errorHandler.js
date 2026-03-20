import { AppError } from '../errors/AppError.js';

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
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

export { errorHandler };
