import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken, type TokenPayload } from '../lib/jwt.js';

const BEARER_PREFIX = 'Bearer ';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith(BEARER_PREFIX)) {
    next(unauthorized('Missing bearer token.'));
    return;
  }

  try {
    req.user = verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Reads the authenticated user off the request. Every query in the service layer
 * is scoped by this id, which is what keeps one user's data invisible to another.
 * Throwing rather than returning undefined means a route accidentally mounted
 * without `authenticate` fails loudly instead of leaking data.
 */
export function requireUser(req: Request): TokenPayload {
  if (!req.user) {
    throw unauthorized('This route requires an authenticated user.');
  }
  return req.user;
}
