import type { Request, Response } from 'express';
import { isReading } from '../readings/reading.js';
import type { SaveReading, ListReadings } from '../data/readings.js';

export function createAcceptReading(saveReading: SaveReading) {
  return async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;

    if (!req.is('application/json') || !isReading(body)) {
      res.status(400).json({
        status: 'invalid',
        message: 'Medición inválida: se requiere un objeto JSON con únicamente nodeId (string no vacío), soilMoistureRaw (entero entre 0 y 4095) y vibrationDetected (boolean), opcionalmente con el bloque completo accelX, accelY, accelZ, gyroX, gyroY, gyroZ y temperature (siete n�meros finitos).',
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

export function createListReadings(loadReadings: ListReadings) {
  return async (req: Request, res: Response): Promise<void> => {
    const value = req.query.limit;
    let limit = 50;
    if (value !== undefined) {
      if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        res.status(400).json({ status: 'error', message: 'limit debe ser un entero entre 1 y 100.' });
        return;
      }
      limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        res.status(400).json({ status: 'error', message: 'limit debe ser un entero entre 1 y 100.' });
        return;
      }
    }
    try {
      res.status(200).json({ readings: await loadReadings(limit) });
    } catch {
      res.status(500).json({ status: 'error', message: 'No se pudieron consultar las mediciones.' });
    }
  };
}

export function createLatestReading(loadReadings: ListReadings) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const [reading] = await loadReadings(1);
      if (!reading) {
        res.status(404).json({ status: 'error', message: 'No hay mediciones disponibles.' });
        return;
      }
      res.status(200).json({ reading });
    } catch {
      res.status(500).json({ status: 'error', message: 'No se pudieron consultar las mediciones.' });
    }
  };
}
