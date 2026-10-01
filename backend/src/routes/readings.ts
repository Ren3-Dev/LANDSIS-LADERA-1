import { Router, json } from 'express';
import type { ErrorRequestHandler } from 'express';
import { acceptReading } from '../controllers/readings.js';

const readingsRouter = Router();

readingsRouter.post('/', json(), acceptReading);

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

export default readingsRouter;
