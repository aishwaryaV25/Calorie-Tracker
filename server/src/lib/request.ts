import type { Request } from 'express';
import { badRequest } from './errors.js';

export function pathParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Missing "${name}" path parameter.`);
  }

  return value;
}
