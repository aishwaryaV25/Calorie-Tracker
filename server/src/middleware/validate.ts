import type { Request, RequestHandler } from 'express';
import { matchedData, validationResult, type Location } from 'express-validator';
import { badRequest } from '../lib/errors.js';

/**
 * Runs after a route's validation chains and turns any failures into a single
 * 400 listing every offending field, so the client can highlight all of them at
 * once rather than one per round trip.
 */
export const handleValidation: RequestHandler = (req, _res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    next();
    return;
  }

  const details = result.array().map((error) => ({
    field: error.type === 'field' ? error.path : error.type,
    message: error.msg as string,
  }));

  next(badRequest('One or more fields are invalid.', details));
};

/**
 * Returns only the fields that were declared in the validation chains, already
 * sanitised and type-converted.
 *
 * Reading through `matchedData` rather than `req.body` / `req.query` matters for
 * two reasons: unexpected fields a client sends are dropped instead of reaching
 * the database, and Express 5 derives `req.query` from a getter, so sanitised
 * values written back onto it would not survive.
 */
export function validated<T extends object>(req: Request, location: Location): T {
  return matchedData<T>(req, { locations: [location], includeOptionals: false });
}

export const validatedBody = <T extends object>(req: Request): T => validated<T>(req, 'body');
export const validatedQuery = <T extends object>(req: Request): T => validated<T>(req, 'query');
export const validatedParams = <T extends object>(req: Request): T => validated<T>(req, 'params');
