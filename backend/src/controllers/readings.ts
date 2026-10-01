import type { Request, Response } from 'express';
import { isReading } from '../readings/reading.js';

export function acceptReading(req: Request, res: Response): void {
  const body: unknown = req.body;

  if (!req.is('application/json') || !isReading(body)) {
    res.status(400).json({
      status: 'invalid',
      message: 'Medición inválida: se requiere un objeto JSON con únicamente nodeId (string no vacío), soilMoistureRaw (entero entre 0 y 4095) y vibrationDetected (boolean).',
    });
    return;
  }

  res.status(201).json({ status: 'accepted', reading: body });
}
