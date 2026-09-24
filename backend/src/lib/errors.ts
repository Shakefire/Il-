import { FastifyReply } from "fastify";

/**
 * Application error with HTTP status code.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, message, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(400, message, "VALIDATION_ERROR");
  }
}

/**
 * Send a structured error response.
 */
export function sendError(reply: FastifyReply, error: AppError): void {
  reply.status(error.statusCode).send({
    error: error.message,
    code: error.code,
  });
}

/**
 * Fastify error handler for AppError instances.
 */
export function handleError(error: unknown, reply: FastifyReply): void {
  if (error instanceof AppError) {
    sendError(reply, error);
    return;
  }

  // Unknown errors
  console.error("[Ilé] Unhandled error:", error);
  reply.status(500).send({
    error: "An unexpected error occurred. Please try again later.",
    code: "INTERNAL_ERROR",
  });
}
