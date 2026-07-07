/** Error carrying an HTTP status code and a machine-readable code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string, code = 'PAYLOAD_TOO_LARGE') {
    super(message, 413, code);
  }
}
