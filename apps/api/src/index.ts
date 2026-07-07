import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`GrowEasy CSV Importer API listening on :${config.port}`, {
    aiEnabled: config.aiEnabled,
    model: config.aiEnabled ? config.gemini.model : 'heuristic-fallback',
    env: config.nodeEnv,
  });
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Force-exit if connections linger.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
