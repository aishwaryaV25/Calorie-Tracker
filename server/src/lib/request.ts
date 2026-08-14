import type { Request } from 'express';
import { badRequest } from './errors.js';

/**
 * Express 5 types route params as `string | string[] | undefined` to allow for
 * repeated and optional segments. Routes here validate params first, so this
 * narrows to a single string and fails loudly if a route is ever mounted without
 * the matching segment.
 */
export function pathParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Missing "${name}" path parameter.`);
  }

  return value;
}
