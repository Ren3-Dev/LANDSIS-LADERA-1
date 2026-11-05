import { formatMoisture } from '../moisture';
import InterfaceIcon from './InterfaceIcon';
import type { Reading } from '../types/telemetry';
import { formatTimestamp, formatVibration, formatMpu } from '../presentation';
import MpuPanel from './MpuPanel';
import MoistureChart from './MoistureChart';
import RiskPanel from './RiskPanel';
import OrientationPanel from './OrientationPanel';
import DailyReadings from './DailyReadings';
import NodeNotice from './NodeNotice';
import { receptionState, receptionLabel } from '../reception';
export function DashboardView({ reading, nodeId, now = Date.now(), queriedAt = null }: { reading: Reading | null; nodeId: string; now?: number; queriedAt?: string | null }) {
  const orientation = reading?.orientation;
  return <>
    <RiskPanel orientation={orientation} receivedAt={reading?.receivedAt} now={now}/>
    <div className="cards">
      <article className="card"><p className="eyebrow"><InterfaceIcon name="moisture"/>HUMEDAD DEL SUELO</p><strong className="metric">{formatMoisture(reading?.soilMoistureRaw)}</strong><p>RAW ADC: {reading?.soilMoistureRaw ?? 'Sin lectura'}</p><p>Humedad relativa del sensor · seco 0 %, agua 100 %</p></article>
      <article className="card"><p className="eyebrow"><InterfaceIcon name="vibration"/>VIBRACIÓN</p><strong className="state">{formatVibration(reading?.vibrationDetected)}</strong><p>Valor de la última medición recibida</p></article>
      <article className="card"><p className="eyebrow"><InterfaceIcon name="node"/>INCLINACIÓN</p>
        {orientation?.status === 'ready' ? <dl className="inclination-card-values"><div><dt>Delta roll</dt><dd>{orientation.deltaRoll.toFixed(2)}°</dd></div><div><dt>Delta pitch</dt><dd>{orientation.deltaPitch.toFixed(2)}°</dd></div></dl> : <strong className="state">{orientation?.status === 'calibrating' ? 'Calibrando referencia' : 'Sin orientación válida'}</strong>}
        <p>Cambio relativo a la referencia de arranque</p>
      </article>
    </div>
    <OrientationPanel {...(orientation ? {orientation} : {})} temperature={reading?.temperature} receivedAt={reading?.receivedAt} now={now}/>
    <section className="panel reception-summary" aria-labelledby="reception-title">
      <div><p className="eyebrow" id="reception-title"><InterfaceIcon name="communication"/>RECEPCIÓN DEL NODO · {nodeId}</p>
        <strong className="state">{receptionLabel(receptionState(reading?.receivedAt, now))}</strong>
        <p className="caption">Recepción reciente: menos de 60 segundos desde la última medición.</p>
      </div>
      <div><p className="eyebrow">ÚLTIMA RECEPCIÓN</p><strong className="reception">{reading ? <time dateTime={reading.receivedAt}>{formatTimestamp(reading.receivedAt)}</time> : 'Sin lectura'}</strong><p className="caption">Hora local del navegador · frecuencia de pantalla configurable</p></div>
    </section>
    <NodeNotice reading={reading} now={now} queriedAt={queriedAt}/>
  </>;
}
export function HistoryView({ readings, dailyReadings = [] }: { readings: Reading[]; dailyReadings?: Reading[] }) {
  return <><DailyReadings readings={dailyReadings}/><section className="panel"><div className="section-heading"><h2>Humedad del suelo — %</h2><span className="tag">{readings.length} lecturas</span></div><MoistureChart readings={readings}/></section><section className="panel"><h2>Historial de mediciones almacenadas</h2><p className="caption">Más recientes primero. Fecha/hora local del navegador. Porcentaje relativo del sensor junto al RAW original.</p>{readings.length ? <div className="table-scroll"><table><thead><tr>{['Fecha/hora','Humedad (%) / RAW','Vibración','MPU disponible','Detalles'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{readings.map(reading => <tr key={reading.id}><td><time dateTime={reading.receivedAt}>{formatTimestamp(reading.receivedAt)}</time></td><td className="raw-cell">{formatMoisture(reading.soilMoistureRaw)} · RAW {reading.soilMoistureRaw}</td><td>{formatVibration(reading.vibrationDetected)}</td><td>{formatMpu(reading)}</td><td><details><summary>Ver MPU</summary><MpuPanel reading={reading}/></details></td></tr>)}</tbody></table></div> : <p className="empty" role="status">No hay mediciones para este nodo en el intervalo consultado.</p>}</section></>;
}
export function NodeStatusView({ reading, now = Date.now() }: { reading: Reading | null; now?: number }) {
  const indicators = [['Última recepción',formatTimestamp(reading?.receivedAt)],['Recepción de datos',reading ? 'Datos recibidos' : 'Sin datos'],['Estado de recepción',receptionLabel(receptionState(reading?.receivedAt, now))],['MPU6050',formatMpu(reading)],['Humedad',reading ? 'Lectura disponible' : 'Sin lectura'],['Vibración',reading ? 'Lectura digital disponible' : 'Sin lectura'],['Inclinación relativa',reading?.orientation?.status === 'ready' ? 'Grados disponibles' : reading?.orientation?.status === 'calibrating' ? 'Calibrando referencia' : 'Sin orientación disponible']];
  return <section className="panel"><h2>Disponibilidad de datos del nodo</h2><p className="caption">Estado técnico basado en la última medición recibida. No es una evaluación del riesgo de deslizamiento.</p><dl className="node-indicators">{indicators.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

