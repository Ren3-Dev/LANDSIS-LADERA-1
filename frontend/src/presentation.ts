import type { Reading } from './types/telemetry';
import { mpuFields } from './types/telemetry';
export type TelemetryPage = 'dashboard' | 'history' | 'node';
export type Page = TelemetryPage | 'users';
export const formatReading = (value: number | null | undefined) => value == null ? 'Sin lectura' : String(value);
export const formatTimestamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Sin lectura';
export const formatVibration = (value: boolean | null | undefined) => value == null ? 'Sin lectura' : value ? 'Detectada' : 'No detectada';
export const formatMpu = (reading: Reading | null) => !reading ? 'Sin lectura' : mpuFields.every(field => reading[field] !== null) ? 'Telemetría MPU disponible' : 'Sin telemetría MPU';
