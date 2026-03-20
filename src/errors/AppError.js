class AppError extends Error {
  constructor(params) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.error = params.error;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super({ statusCode: 400, error: 'ValidationError', message });
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super({ statusCode: 409, error: 'ConflictError', message });
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super({ statusCode: 404, error: 'NotFoundError', message });
  }
}

export { AppError, ValidationError, ConflictError, NotFoundError };
