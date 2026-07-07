import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { extractRouter } from './routes/extract.js';
import { healthRouter } from './routes/health.js';

/** Builds the Express app (exported separately so tests can mount it without listening). */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: `${Math.ceil(config.upload.maxFileSizeBytes / (1024 * 1024))}mb` }));
  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.get('/', (_req, res) => {
    res.json({ name: 'GrowEasy CSV Importer API', status: 'ok' });
  });

  app.use('/api', healthRouter);
  app.use('/api', extractRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
