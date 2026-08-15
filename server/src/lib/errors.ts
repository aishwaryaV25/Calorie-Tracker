/**
 * Errors thrown anywhere in a request are expected to be `AppError` instances.
 * The error middleware turns them into a response verbatim; anything else is
 * treated as an unexpected fault and reported as a generic 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Authentication required.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} was not found.`);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const payloadTooLarge = (message: string) =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);

export const tooManyRequests = (message: string, retryAfterSeconds = 60) =>
  new AppError(429, 'RATE_LIMITED', message, { retryAfterSeconds });

export const serviceUnavailable = (message: string) =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);
