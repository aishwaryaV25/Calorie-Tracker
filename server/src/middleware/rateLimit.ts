import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { tooManyRequests } from '../lib/errors.js';

interface Window {
  hits: number[];
}

const windows = new Map<string, Window>();

export interface RateLimitOptions {

  max: number;
  windowMs: number;

  name: string;
}

export function clientKey(req: { ip?: string; user?: { userId: string } }): string {
  return req.user?.userId ?? req.ip ?? 'anonymous';
}

export function takeSlot(key: string, max: number, windowMs: number, now = Date.now()): number | null {
  const current = windows.get(key) ?? { hits: [] };
  current.hits = current.hits.filter((at) => now - at < windowMs);

  if (current.hits.length >= max) {
    const oldest = current.hits[0] ?? now;
    windows.set(key, current);
    return Math.max(1, Math.ceil((oldest + windowMs - now) / 1_000));
  }

  current.hits.push(now);
  windows.set(key, current);
  return null;
}

export function resetRateLimits() {
  windows.clear();
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return (req, _res, next) => {
    if (config.isTest || config.nodeEnv === 'development') {
      next();
      return;
    }

    const retryAfter = takeSlot(`${options.name}:${clientKey(req)}`, options.max, options.windowMs);

    if (retryAfter !== null) {
      next(
        tooManyRequests(
          `Too many requests. Try again in about ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
          retryAfter,
        ),
      );
      return;
    }

    next();
  };
}
