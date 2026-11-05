import type { Reading, MpuReading } from '../readings/reading.js';
import { getPool } from './postgres.js';
import type { ReadingFilters } from '../readings/query.js';

export interface PersistedReading extends Omit<Reading, keyof MpuReading | 'orientation'> {
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  temperature: number | null;

  id: number;
  receivedAt: string;
}

export type SaveReading = (reading: Reading) => Promise<PersistedReading>;
export type ListReadings = (limit: number, filters?: ReadingFilters) => Promise<PersistedReading[]>;

interface ReadingRow {
  id: number;
  node_id: string;
  soil_moisture_raw: number;
  vibration_detected: boolean;
  received_at: Date;
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
  gyro_x: number | null;
  gyro_y: number | null;
  gyro_z: number | null;
  temperature: number | null;

}

export const insertReading: SaveReading = async (reading) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO nodes (node_id) VALUES ($1) ON CONFLICT DO NOTHING', [reading.nodeId]);
    const result = await client.query<ReadingRow>(
      `INSERT INTO sensor_readings (node_id, soil_moisture_raw, vibration_detected,
         accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, node_id, soil_moisture_raw, vibration_detected, received_at,
         accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature`,
      [reading.nodeId, reading.soilMoistureRaw, reading.vibrationDetected,
        reading.accelX ?? null, reading.accelY ?? null, reading.accelZ ?? null,
        reading.gyroX ?? null, reading.gyroY ?? null, reading.gyroZ ?? null, reading.temperature ?? null],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('La inserción no devolvió la medición.');
    }
    const persisted = toReading(row);
    await client.query('COMMIT');
    return persisted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

function toReading(row: ReadingRow): PersistedReading {
  return {
    id: row.id,
    nodeId: row.node_id,
    soilMoistureRaw: row.soil_moisture_raw,
    vibrationDetected: row.vibration_detected,
    receivedAt: row.received_at.toISOString(),
    accelX: row.accel_x,
    accelY: row.accel_y,
    accelZ: row.accel_z,
    gyroX: row.gyro_x,
    gyroY: row.gyro_y,
    gyroZ: row.gyro_z,
    temperature: row.temperature,

  };
}

export const listReadings: ListReadings = async (limit, filters = {}) => {
  const parameters: (number | string)[] = [limit];
  const clauses: string[] = [];
  for (const [value, column, operator] of [
    [filters.nodeId, 'node_id', '='],
    [filters.from, 'received_at', '>='],
    [filters.to, 'received_at', '<'],
  ] as const) {
    if (value !== undefined) {
      parameters.push(value);
      clauses.push(`${column} ${operator} $${parameters.length}`);
    }
  }
  const result = await getPool().query<ReadingRow>(
    `SELECT id, node_id, soil_moisture_raw, vibration_detected, received_at,
       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature
     FROM sensor_readings
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY received_at DESC, id DESC
     LIMIT $1`,
    parameters,
  );
  return result.rows.map(toReading);
};

// Una fila real por fecha de recepción en Guatemala, no un promedio ni una inserción diaria.
export const listDailyReadings: ListReadings = async (limit, filters = {}) => {
  if (!filters.nodeId) throw new Error('nodeId es obligatorio para mediciones diarias.');
  const parameters: (string | number)[] = [filters.nodeId];
  const clauses = ['node_id = $1'];
  for (const [key, operator] of [['from', '>='], ['to', '<']] as const) {
    if (filters[key] !== undefined) {
      parameters.push(filters[key]);
      clauses.push(`received_at ${operator} $${parameters.length}`);
    }
  }
  parameters.push(limit);
  const result = await getPool().query<ReadingRow>(
    `SELECT DISTINCT ON ((received_at AT TIME ZONE 'America/Guatemala')::date)
       id, node_id, soil_moisture_raw, vibration_detected, received_at,
       accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, temperature
     FROM sensor_readings
     WHERE ${clauses.join(' AND ')}
     ORDER BY (received_at AT TIME ZONE 'America/Guatemala')::date DESC, received_at DESC, id DESC
     LIMIT $${parameters.length}`,
    parameters,
  );
  return result.rows.map(toReading);
};
