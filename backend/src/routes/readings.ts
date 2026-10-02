import { Router, json } from 'express';
import type { ErrorRequestHandler } from 'express';
import { createAcceptReading } from '../controllers/readings.js';
import type { SaveReading } from '../data/readings.js';

export function createReadingsRouter(saveReading: SaveReading) {
  const readingsRouter = Router();

  readingsRouter.post('/', json(), createAcceptReading(saveReading));

  const handleInvalidJson: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (
      error instanceof SyntaxError &&
      'type' in error &&
      error.type === 'entity.parse.failed'
    ) {
      res.status(400).json({
        status: 'invalid',
        message: 'Medición inválida: el cuerpo debe contener JSON válido.',
      });
      return;
    }

    next(error);
  };

  readingsRouter.use(handleInvalidJson);

  return readingsRouter;
}
