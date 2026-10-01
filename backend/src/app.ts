import express from 'express';

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'LANDSIS LADERA-1 API',
  });
});

export default app;
