import express from 'express';
import { createReadingsRouter } from './routes/readings.js';
import { insertReading, listReadings } from './data/readings.js';
import type { SaveReading, ListReadings } from './data/readings.js';
import { listNodes } from './data/nodes.js';
import type { ListNodes } from './data/nodes.js';
import { createNodesRouter } from './routes/nodes.js';

export function createApp(
  saveReading: SaveReading = insertReading,
  loadReadings: ListReadings = listReadings,
  loadNodes: ListNodes = listNodes,
) {
  const app = express();

  app.use('/api/v1/readings', createReadingsRouter(saveReading, loadReadings));
  app.use('/api/v1/nodes', createNodesRouter(loadNodes));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'LANDSIS LADERA-1 API',
    });
  });

  return app;
}

export default createApp();
