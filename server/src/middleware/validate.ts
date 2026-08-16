import type { Request, RequestHandler } from 'express';
import { matchedData, validationResult, type Location } from 'express-validator';
import { badRequest } from '../lib/errors.js';

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

export function validated<T extends object>(req: Request, location: Location): T {
  return matchedData<T>(req, { locations: [location], includeOptionals: false });
}

export const validatedBody = <T extends object>(req: Request): T => validated<T>(req, 'body');
export const validatedQuery = <T extends object>(req: Request): T => validated<T>(req, 'query');
export const validatedParams = <T extends object>(req: Request): T => validated<T>(req, 'params');
