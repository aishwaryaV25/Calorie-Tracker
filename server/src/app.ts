import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

function isAllowedOrigin(origin: string): boolean {
  if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app')
    );
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();

  // Render (and any other reverse proxy) terminates TLS. Trust the first hop so
  // forwarded proto/host are visible if we ever need them.
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // same-origin CORP would hide every response from the Vercel app, which the
  // browser then reports as a network failure ("Could not reach the server").
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!config.isTest) {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
