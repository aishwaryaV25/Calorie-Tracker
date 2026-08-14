import type { TokenPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware; present on every protected route. */
      user?: TokenPayload;
    }
  }
}

export {};
