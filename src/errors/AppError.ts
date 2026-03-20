export class AppError extends Error {
  public readonly statusCode: number;
  public readonly error: string;

  constructor(params: { statusCode: number; error: string; message: string }) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.error = params.error;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super({ statusCode: 400, error: 'ValidationError', message });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ statusCode: 409, error: 'ConflictError', message });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super({ statusCode: 404, error: 'NotFoundError', message });
  }
}

