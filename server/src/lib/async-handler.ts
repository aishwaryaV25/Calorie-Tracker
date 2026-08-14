import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards rejected promises to the error middleware. Express 5 does this for
 * async handlers natively, but wrapping keeps the behaviour explicit and means
 * the handlers stay readable without try/catch noise.
 */
export const asyncHandler =
  <T>(handler: (req: Request, res: Response, next: NextFunction) => Promise<T>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
