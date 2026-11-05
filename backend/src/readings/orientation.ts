export const angleFields = ['roll', 'pitch', 'baselineRoll', 'baselinePitch', 'deltaRoll', 'deltaPitch'] as const;
export const countFields = ['precautionCount', 'alertCount', 'criticalCount'] as const;
export type Orientation = { status: 'calibrating' | 'unavailable' } | (
  { status: 'ready'; inclinationState: 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'CRITICO' }
  & Record<typeof angleFields[number] | typeof countFields[number], number>
);

export function isOrientation(value: unknown): value is Orientation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.status === 'calibrating' || o.status === 'unavailable') return Object.keys(o).length === 1;
  return o.status === 'ready' && Object.keys(o).length === 11
    && angleFields.every(k => typeof o[k] === 'number' && Number.isFinite(o[k]))
    && countFields.every(k => Number.isInteger(o[k]) && (o[k] as number) >= 0 && (o[k] as number) <= 6)
    && ['NORMAL', 'PRECAUCION', 'ALERTA', 'CRITICO'].includes(String(o.inclinationState));
}

// Solo telemetría actual; nunca se incorpora a otra fila ni al historial.
export class LatestOrientation {
  private values = new Map<number, { nodeId: string; orientation: Orientation }>();
  remember(reading: { id: number; nodeId: string }, orientation: Orientation) {
    this.values.set(reading.id, { nodeId: reading.nodeId, orientation: { ...orientation } });
    if (this.values.size > 256) this.values.delete(this.values.keys().next().value!);
  }
  forReading(reading: { id: number; nodeId: string }): Orientation | undefined {
    const item = this.values.get(reading.id);
    return item?.nodeId === reading.nodeId ? item.orientation : undefined;
  }
}
