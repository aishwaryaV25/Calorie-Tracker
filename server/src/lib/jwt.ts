import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from './errors.js';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    if (typeof decoded === 'string' || !decoded.userId || !decoded.email) {
      throw unauthorized('Malformed authentication token.');
    }

    return { userId: decoded.userId as string, email: decoded.email as string };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    throw unauthorized('Invalid authentication token.');
  }
}
