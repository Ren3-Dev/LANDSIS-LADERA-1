export type Orientation = { status: 'calibrating' | 'unavailable' } | ({
  status: 'ready'; inclinationState: 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'CRITICO';
  roll: number; pitch: number; baselineRoll: number; baselinePitch: number;
  deltaRoll: number; deltaPitch: number; precautionCount: number; alertCount: number; criticalCount: number;
});
export function isOrientation(value: unknown): value is Orientation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.status === 'calibrating' || o.status === 'unavailable') return Object.keys(o).length === 1;
  return o.status === 'ready' && Object.keys(o).length === 11
    && ['roll','pitch','baselineRoll','baselinePitch','deltaRoll','deltaPitch'].every(k => typeof o[k] === 'number' && Number.isFinite(o[k]))
    && ['precautionCount','alertCount','criticalCount'].every(k => Number.isInteger(o[k]) && (o[k] as number) >= 0 && (o[k] as number) <= 6)
    && ['NORMAL','PRECAUCION','ALERTA','CRITICO'].includes(String(o.inclinationState));
}
