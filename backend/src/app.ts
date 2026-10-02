import express from 'express';
import { createReadingsRouter } from './routes/readings.js';
import { insertReading } from './data/readings.js';
import type { SaveReading } from './data/readings.js';

export function createApp(saveReading: SaveReading = insertReading) {
  const app = express();

  app.use('/api/v1/readings', createReadingsRouter(saveReading));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'LANDSIS LADERA-1 API',
    });
  });

  return app;
}

export default createApp();
