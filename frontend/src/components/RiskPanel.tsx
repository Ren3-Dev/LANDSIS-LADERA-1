import type { Orientation } from '../types/orientation';
import { formatTimestamp } from '../presentation';
import { receptionState } from '../reception';

const levels = [
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'PRECAUCION', label: 'PRECAUCIÓN' },
  { value: 'ALERTA', label: 'ALERTA' },
  { value: 'CRITICO', label: 'CRÍTICO' },
] as const;

export default function RiskPanel({ orientation, receivedAt, now = Date.now() }: {
  orientation: Orientation | undefined; receivedAt: string | undefined; now?: number;
}) {
  const reception = receptionState(receivedAt, now);
  const source = orientation?.status === 'ready' ? orientation : null;
  const confirmed = source && (source.inclinationState === 'NORMAL'
    ? [source.precautionCount, source.alertCount, source.criticalCount].every(count => count < 6)
    : source.inclinationState === 'PRECAUCION' ? source.precautionCount === 6
    : source.inclinationState === 'ALERTA' ? source.alertCount === 6 : source.criticalCount === 6);
  const ready = confirmed && reception === 'fresh' ? source : null;
  const active = ready ? levels.find(level => level.value === ready.inclinationState) : undefined;
  const pending = ready && [ready.precautionCount, ready.alertCount, ready.criticalCount].some(count => count > 0 && count < 6);
  const title = reception === 'stale' ? 'Sin datos recientes' : reception === 'invalid' ? 'Hora de recepción por verificar' : reception === 'missing' ? 'Esperando datos' : active?.label ?? (source && !confirmed ? 'Persistencia sin confirmar' : orientation?.status === 'calibrating' ? 'Calibrando referencia' : orientation?.status === 'unavailable' ? 'Sin lectura válida' : 'Esperando orientación');
  return <section className="panel risk-summary inclination-signal" aria-labelledby="risk-title">
    <div><p className="eyebrow" id="risk-title">SEMÁFORO EXPERIMENTAL DE INCLINACIÓN</p>
      <strong className="state">{title}</strong>
      {pending && <p className="inclination-pending">Persistencia en observación: aún no se confirma un nivel superior.</p>}
      <ol className="risk-levels" aria-label="Niveles de inclinación de la última medición">{levels.map(level => <li key={level.value} data-level={level.value} data-active={ready?.inclinationState === level.value}><span className="risk-level-dot" aria-hidden="true"/>{level.label}{ready?.inclinationState === level.value && <span className="active-level-label">Activo</span>}</li>)}</ol>
      <p className="caption">{receivedAt ? <>Última recepción: <time dateTime={receivedAt}>{formatTimestamp(receivedAt)}</time>.</> : 'Sin medición disponible.'} El indicador queda gris tras 60 segundos sin una nueva recepción.</p>
      {ready ? <p className="caption">Persistencia recibida: precaución {ready.precautionCount}/6 · alerta {ready.alertCount}/6 · crítico {ready.criticalCount}/6. El nivel se toma del firmware; una lectura aislada no se convierte en CRÍTICO desde el dashboard.</p> : <p className="caption">Ningún nivel está activo hasta recibir datos recientes y orientación válida.</p>}
      <div className="global-risk-status"><strong>Riesgo global: no evaluado</strong><p className="caption">Pendiente de configuración de criterios combinados. Humedad y vibración se muestran como contexto y no modifican este semáforo de inclinación.</p></div>
    </div>
  </section>;
}
