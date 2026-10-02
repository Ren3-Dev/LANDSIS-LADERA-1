import type { Reading } from '../readings/reading.js';
import { getPool } from './postgres.js';

export interface PersistedReading extends Reading {
  id: number;
  receivedAt: string;
}

export type SaveReading = (reading: Reading) => Promise<PersistedReading>;

interface ReadingRow {
  id: number;
  node_id: string;
  soil_moisture_raw: number;
  vibration_detected: boolean;
  received_at: Date;
}

export const insertReading: SaveReading = async (reading) => {
  const result = await getPool().query<ReadingRow>(
    `INSERT INTO sensor_readings (node_id, soil_moisture_raw, vibration_detected)
     VALUES ($1, $2, $3)
     RETURNING id, node_id, soil_moisture_raw, vibration_detected, received_at`,
    [reading.nodeId, reading.soilMoistureRaw, reading.vibrationDetected],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('La inserción no devolvió la medición.');
  }
  return {
    id: row.id,
    nodeId: row.node_id,
    soilMoistureRaw: row.soil_moisture_raw,
    vibrationDetected: row.vibration_detected,
    receivedAt: row.received_at.toISOString(),
  };
};
