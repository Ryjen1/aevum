/**
 * Central error handler.
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";
import { ZodError } from "zod";

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "not_found", message: `Route ${req.method} ${req.path} not found` },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request body",
        details: err.issues,
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    logger.warn({ err: err.message, code: err.code, path: req.path }, "HttpError");
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  logger.error({ err: msg, stack: err instanceof Error ? err.stack : undefined, path: req.path }, "unhandled error");
  res.status(500).json({
    error: { code: "internal_error", message: "Internal server error" },
  });
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
