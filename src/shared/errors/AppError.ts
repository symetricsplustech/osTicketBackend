export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PRECONDITION_FAILED'
  | 'UNPROCESSABLE_ENTITY'
  | 'APPROVAL_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TENANT_SUSPENDED'
  | 'MAINTENANCE_MODE';

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];
  public readonly expose: boolean;
  public readonly meta?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetail[]; expose?: boolean; meta?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.expose = options?.expose ?? statusCode < 500;
    this.meta = options?.meta;
    if (options?.cause) this.cause = options.cause;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'The request is invalid.', details?: ErrorDetail[]) {
    super(400, 'BAD_REQUEST', message, { details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed.', details?: ErrorDetail[]) {
    super(422, 'VALIDATION_ERROR', message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} was not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The resource already exists or conflicts with an existing record.') {
    super(409, 'CONFLICT', message);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message = 'The resource is not in a state that allows this action.') {
    super(412, 'PRECONDITION_FAILED', message);
  }
}

export class ApprovalRequiredError extends AppError {
  constructor(message = 'This action requires approval before it can be completed.', meta?: Record<string, unknown>) {
    super(202, 'APPROVAL_REQUIRED', message, { meta });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
  }
}
