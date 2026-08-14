import { Router } from 'express';
import { aiRouter } from './ai.js';
import { authRouter } from './auth.js';
import { entriesRouter } from './entries.js';
import { goalsRouter } from './goals.js';
import { reportsRouter } from './reports.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/entries', entriesRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/ai', aiRouter);
