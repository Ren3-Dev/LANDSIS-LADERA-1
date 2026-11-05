import type { Orientation } from '../types/orientation';
import NodeTiltReference from './NodeTiltReference';
const degrees = (value: number) => `${value.toFixed(2)}°`;
function TemperatureNote({ temperature }: { temperature: number | null | undefined }) {
  return <div className="orientation-temperature"><h3>Temperatura del MPU6050</h3><strong className="temperature">{temperature == null ? 'Sin lectura' : `${temperature.toFixed(2)} °C`}</strong>
    <p className="caption">Temperatura interna del módulo MPU6050. Es un dato de diagnóstico del sensor; no representa la temperatura del suelo ni del ambiente.</p></div>;
}
export default function OrientationPanel({ orientation, temperature, receivedAt, now }: { orientation?: Orientation; temperature?: number | null; receivedAt?: string; now?: number }) {
  if (!orientation || orientation.status !== 'ready') {
    const title = !orientation ? 'Esperando orientación' : orientation.status === 'calibrating' ? 'Calibrando referencia' : 'Sin lectura válida';
    return <section className="panel orientation-summary"><h2>Inclinación relativa</h2><strong className="state">{title}</strong>
      <p>{orientation?.status === 'calibrating' ? 'El nodo está tomando la referencia inicial. Mantén el montaje inmóvil hasta finalizar.' : 'Aún no hay orientación válida asociada a esta medición. Actualiza después del próximo envío del nodo.'}</p>
      <p className="caption">Se muestran los ángulos calculados por el firmware cuando están disponibles.</p><NodeTiltReference orientation={orientation} receivedAt={receivedAt} now={now}/><TemperatureNote temperature={temperature}/></section>;
  }
  const labels = {NORMAL:'NORMAL',PRECAUCION:'PRECAUCIÓN',ALERTA:'ALERTA',CRITICO:'CRÍTICO'};
  const angles: [string, number][] = [['Roll actual',orientation.roll],['Pitch actual',orientation.pitch],['Baseline roll',orientation.baselineRoll],['Baseline pitch',orientation.baselinePitch]];
  return <section className="panel orientation-summary"><div className="section-heading"><h2>Inclinación relativa</h2><span className="tag">Grados recibidos del nodo</span></div>
    <div className="orientation-deltas"><div><p className="eyebrow">DELTA ROLL</p><strong className="metric">{degrees(orientation.deltaRoll)}</strong></div><div><p className="eyebrow">DELTA PITCH</p><strong className="metric">{degrees(orientation.deltaPitch)}</strong></div></div>
    <NodeTiltReference orientation={orientation} receivedAt={receivedAt} now={now}/>
    <dl className="orientation-values">{angles.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{degrees(value)}</dd></div>)}</dl>
    <p><strong>Estado de inclinación: {labels[orientation.inclinationState]}</strong></p>
    <p className="caption">Persistencia: precaución {orientation.precautionCount}/6 · alerta {orientation.alertCount}/6 · crítico {orientation.criticalCount}/6</p>
    <p className="caption">Desplazamiento angular respecto a la referencia de arranque. Estado experimental de inclinación, independiente del riesgo global de deslizamiento.</p>
    <TemperatureNote temperature={temperature}/>
  </section>;
}
