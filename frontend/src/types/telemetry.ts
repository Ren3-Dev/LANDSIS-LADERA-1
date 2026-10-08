export const mpuFields = ['accelX', 'accelY', 'accelZ', 'gyroX', 'gyroY', 'gyroZ', 'temperature'] as const;
export type Reading = {
  id: number; nodeId: string; soilMoistureRaw: number;
  vibrationDetected: boolean; receivedAt: string;
} & Record<typeof mpuFields[number], number | null>;
export interface Node { nodeId: string }
