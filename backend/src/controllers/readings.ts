import type { Request, Response } from 'express';
import { isReading } from '../readings/reading.js';
import type { SaveReading } from '../data/readings.js';

export function createAcceptReading(saveReading: SaveReading) {
  return async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;

    if (!req.is('application/json') || !isReading(body)) {
      res.status(400).json({
        status: 'invalid',
        message: 'Medición inválida: se requiere un objeto JSON con únicamente nodeId (string no vacío), soilMoistureRaw (entero entre 0 y 4095) y vibrationDetected (boolean).',
      });
      return;
    }

    try {
      const reading = await saveReading(body);
      res.status(201).json({ status: 'accepted', reading });
    } catch {
      res.status(500).json({
        status: 'error',
        message: 'No se pudo almacenar la medición.',
      });
    }
  };
}
