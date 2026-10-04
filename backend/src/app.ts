import express from 'express';
import { createReadingsRouter } from './routes/readings.js';
import { insertReading, listReadings } from './data/readings.js';
import type { SaveReading, ListReadings } from './data/readings.js';

export function createApp(
  saveReading: SaveReading = insertReading,
  loadReadings: ListReadings = listReadings,
) {
  const app = express();

  app.use('/api/v1/readings', createReadingsRouter(saveReading, loadReadings));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'LANDSIS LADERA-1 API',
    });
  });

  return app;
}

export default createApp();
