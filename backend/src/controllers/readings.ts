import type { Request, Response } from 'express';
import { isReading } from '../readings/reading.js';
import type { SaveReading, ListReadings } from '../data/readings.js';
import { parseReadingQuery } from '../readings/query.js';
import type { LatestOrientation } from '../readings/orientation.js';
import type { CommittedReadingObserver } from '../alerts/types.js';

export function createAcceptReading(saveReading: SaveReading, orientations?: LatestOrientation, observe?: CommittedReadingObserver) {
  return async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;

    if (!req.is('application/json') || !isReading(body)) {
      res.status(400).json({
        status: 'invalid',
        message: 'Medición inválida: se requiere un objeto JSON con únicamente nodeId (string no vacío), soilMoistureRaw (entero entre 0 y 4095) y vibrationDetected (boolean), opcionalmente con el bloque completo accelX, accelY, accelZ, gyroX, gyroY, gyroZ y temperature (siete números finitos), y orientation opcional validada (status calibrating/unavailable o bloque ready completo).',
      });
      return;
    }

    if (res.locals?.deviceNodeId && body.nodeId !== res.locals.deviceNodeId) {
      res.status(403).json({ message: 'Dispositivo no autorizado para este nodo.' }); return;
    }
    try {
      const { orientation, ...measurement } = body;
      const reading = await saveReading(measurement);
      if (orientation) orientations?.remember(reading, orientation);
      try { observe?.(orientation ? {...reading, orientation} : reading); }
      catch { console.error('No se pudo programar el aviso de inclinación.'); }
      res.status(201).json({ status: 'accepted', reading });
    } catch {
      res.status(500).json({
        status: 'error',
        message: 'No se pudo almacenar la medición.',
      });
    }
  };
}

export function createListReadings(loadReadings: ListReadings, requireNode = false) {
  return async (req: Request, res: Response): Promise<void> => {
    let parsed;
    try {
      parsed = parseReadingQuery(req.query);
      if (requireNode && !parsed.filters.nodeId) throw new Error('nodeId es obligatorio para mediciones diarias.');
    }
    catch (error) {
      res.status(400).json({ status: 'error', message: (error as Error).message });
      return;
    }
    try {
      res.status(200).json({ readings: await loadReadings(parsed.limit, parsed.filters) });
    } catch {
      res.status(500).json({ status: 'error', message: 'No se pudieron consultar las mediciones.' });
    }
  };
}

export function createLatestReading(loadReadings: ListReadings, orientations?: LatestOrientation) {
  return async (req: Request, res: Response): Promise<void> => {
    let parsed;
    try { parsed = parseReadingQuery(req.query, true); }
    catch (error) {
      res.status(400).json({ status: 'error', message: (error as Error).message });
      return;
    }
    try {
      const [reading] = await loadReadings(1, parsed.filters);
      if (!reading) {
        res.status(404).json({ status: 'error', message: 'No hay mediciones disponibles.' });
        return;
      }
      const orientation = orientations?.forReading(reading);
      res.status(200).json({ reading: orientation ? { ...reading, orientation } : reading });
    } catch {
      res.status(500).json({ status: 'error', message: 'No se pudieron consultar las mediciones.' });
    }
  };
}
