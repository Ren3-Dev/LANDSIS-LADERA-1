import { isOrientation, type Orientation } from './orientation.js';
export interface MpuReading {
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  temperature: number;
}

export interface Reading extends Partial<MpuReading> {
  nodeId: string;
  soilMoistureRaw: number;
  vibrationDetected: boolean;
  orientation?: Orientation;
}

export function isReading(value: unknown): value is Reading {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const reading = value as Record<string, unknown>;
  const fields = ['nodeId', 'soilMoistureRaw', 'vibrationDetected'];
  const mpuFields = ['accelX', 'accelY', 'accelZ', 'gyroX', 'gyroY', 'gyroZ', 'temperature'];
  const mpuCount = mpuFields.filter((field) => Object.hasOwn(reading, field)).length;

  return (
    (mpuCount === 0 || mpuCount === mpuFields.length) &&
    Object.keys(reading).length === fields.length + mpuCount + (Object.hasOwn(reading, 'orientation') ? 1 : 0) &&
    (!Object.hasOwn(reading, 'orientation') || (mpuCount === 7 && isOrientation(reading.orientation))) &&
    (mpuCount === 0 || mpuFields.every((field) =>
      typeof reading[field] === 'number' && Number.isFinite(reading[field]))) &&
    fields.every((field) => Object.hasOwn(reading, field)) &&
    typeof reading.nodeId === 'string' &&
    reading.nodeId.trim().length > 0 &&
    typeof reading.soilMoistureRaw === 'number' &&
    Number.isInteger(reading.soilMoistureRaw) &&
    reading.soilMoistureRaw >= 0 &&
    reading.soilMoistureRaw <= 4095 &&
    typeof reading.vibrationDetected === 'boolean'
  );
}
