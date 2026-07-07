import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiEnabled: config.aiEnabled,
    model: config.aiEnabled ? config.gemini.model : null,
    mode: config.aiEnabled ? 'gemini' : 'heuristic',
  });
});
