import express from 'express';
import { createReadingsRouter } from './routes/readings.js';
import { insertReading, listReadings, listDailyReadings } from './data/readings.js';
import type { SaveReading, ListReadings } from './data/readings.js';
import { listNodes } from './data/nodes.js';
import type { ListNodes } from './data/nodes.js';
import { createNodesRouter } from './routes/nodes.js';
import { createSecurity, type Security } from './auth/security.js';
import type { CommittedReadingObserver } from './alerts/types.js';

export function createApp(
  saveReading: SaveReading = insertReading,
  loadReadings: ListReadings = listReadings,
  loadNodes: ListNodes = listNodes,
  security: Security = createSecurity(),
  loadDailyReadings: ListReadings = listDailyReadings,
  observe?: CommittedReadingObserver,
) {
  const app = express();

  app.use('/api/v1/auth', security.authRouter);
  app.use('/api/v1/users', security.usersRouter);
  app.use('/api/v1/readings', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') security.requireAuth(req, res, next);
    else next();
  }, createReadingsRouter(saveReading, loadReadings, loadDailyReadings, observe));
  app.use('/api/v1/nodes', security.requireAuth, createNodesRouter(loadNodes));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'LANDSIS LADERA-1 API',
    });
  });

  return app;
}

export default createApp();
