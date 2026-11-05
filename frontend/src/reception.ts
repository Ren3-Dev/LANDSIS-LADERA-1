// Criterio de comunicación acordado; independiente de umbrales de inclinación/riesgo.
export const RECEPTION_TIMEOUT_MS = 60_000;
export const LATEST_REFRESH_MS = 10_000;
export const SCREEN_REFRESH_OPTIONS = [
  {ms:10000,label:'10 segundos (pruebas)'},
  {ms:300000,label:'5 minutos'}, {ms:600000,label:'10 minutos'},
  {ms:900000,label:'15 minutos'}, {ms:1800000,label:'30 minutos'},
  {ms:3600000,label:'1 hora'}, {ms:0,label:'Solo manual'},
] as const;
export type ReceptionState = 'fresh' | 'stale' | 'missing' | 'invalid';
export function receptionState(receivedAt: string | null | undefined, now = Date.now()): ReceptionState {
  if (!receivedAt) return 'missing';
  const timestamp = Date.parse(receivedAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now) || timestamp > now) return 'invalid';
  return now - timestamp < RECEPTION_TIMEOUT_MS ? 'fresh' : 'stale';
}
export function receptionLabel(state: ReceptionState): string {
  return {fresh:'Recepción reciente',stale:'Sin recepción reciente',missing:'Sin datos',invalid:'Hora de recepción por verificar'}[state];
}
