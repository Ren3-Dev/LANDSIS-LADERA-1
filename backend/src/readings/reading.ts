export interface Reading {
  nodeId: string;
  soilMoistureRaw: number;
  vibrationDetected: boolean;
}

export function isReading(value: unknown): value is Reading {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const reading = value as Record<string, unknown>;
  const fields = ['nodeId', 'soilMoistureRaw', 'vibrationDetected'];

  return (
    Object.keys(reading).length === fields.length &&
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
