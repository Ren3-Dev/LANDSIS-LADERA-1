import type { Reading } from './types/telemetry';
export const NODE_NOTICE_HOUR = 60 * 60 * 1000;
export interface NodeNoticeState { lastReceived: number; armed: boolean; activatedAt: number | null; recoveredAt: number | null }
export const emptyNodeNotice: NodeNoticeState = {lastReceived:0,armed:false,activatedAt:null,recoveredAt:null};
export function updateNodeNotice(previous: NodeNoticeState, reading: Reading | null, checkedAt: number, now: number): NodeNoticeState {
  const state = {...previous};
  const received = reading ? Date.parse(reading.receivedAt) : NaN;
  if (!Number.isFinite(now) || !Number.isFinite(received) || received > now) return state;
  if (received > state.lastReceived) {
    const o = reading?.orientation;
    state.lastReceived = received;
    state.armed = o?.status === 'ready' && ((o.inclinationState === 'ALERTA' && o.alertCount === 6) || (o.inclinationState === 'CRITICO' && o.criticalCount === 6));
    if (state.activatedAt !== null && now - received < 60000) state.recoveredAt = now;
  }
  // Una consulta exitosa posterior al límite confirma que no hay registros nuevos.
  // Cambiar la pantalla a modo manual o lento no dispara por sí solo este aviso.
  if (state.armed && now - received >= 60000 && checkedAt >= received + 60000 && received === state.lastReceived) {
    if (state.activatedAt === null || state.recoveredAt !== null) state.activatedAt = now;
    state.recoveredAt = null;
  }
  if (state.activatedAt !== null && state.recoveredAt !== null && now - state.activatedAt >= NODE_NOTICE_HOUR) {
    state.activatedAt = null; state.recoveredAt = null;
  }
  return state;
}
export function loadNodeNotice(storage?: Pick<Storage,'getItem'>): NodeNoticeState {
  try {
    const s = JSON.parse(storage?.getItem('landsis-node-notice-v1') ?? 'null');
    if (s && Number.isFinite(s.lastReceived) && s.lastReceived >= 0 && typeof s.armed === 'boolean'
      && (s.activatedAt === null || Number.isFinite(s.activatedAt)) && (s.recoveredAt === null || Number.isFinite(s.recoveredAt))) return s;
  } catch { /* Almacenamiento no disponible o inválido. */ }
  return {...emptyNodeNotice};
}
