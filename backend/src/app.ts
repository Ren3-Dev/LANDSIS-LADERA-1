import express from 'express';
import readingsRouter from './routes/readings.js';

const app = express();

app.use('/api/v1/readings', readingsRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'LANDSIS LADERA-1 API',
  });
});

export default app;
