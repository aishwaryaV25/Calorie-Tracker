import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}.`,
    },
  });
};

/**
 * Single place where an error becomes an HTTP response. Known Prisma failures
 * are mapped to meaningful statuses; anything unrecognised is logged in full and
 * reported as a 500 so internal details never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Multer rejects oversized or unexpected uploads before any handler runs.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is too large.'
        : `Upload rejected: ${err.message}.`;

    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: { code: err.code, message },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A record with these values already exists.' },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'The requested record was not found.' },
      });
      return;
    }

    if (err.code === 'P2024') {
      res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is busy. Please try again in a moment.',
        },
      });
      return;
    }
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      ...(config.isProduction
        ? {}
        : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
};
