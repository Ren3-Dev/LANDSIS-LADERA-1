import type { Reading } from '../types/telemetry';
import { formatMpu } from '../presentation';
const value = (v: number | null | undefined) => v == null ? 'Sin lectura' : String(v);

export default function MpuPanel({ reading }: { reading: Reading | null }) {
  return <section className="panel"><div className="section-heading"><h2>Telemetría MPU6050</h2><span className="tag">{formatMpu(reading)}</span></div>
    <p className="caption">Valores originales recibidos del nodo: aceleración en m/s², giroscopio en rad/s y temperatura del módulo en °C.</p>
    <div className="mpu-grid">{[['Aceleración (m/s²)', 'accel'], ['Giroscopio (rad/s)', 'gyro']].map(([label, prefix]) => <div key={prefix}><h3>{label}</h3><dl>{['X', 'Y', 'Z'].map(axis => <div key={axis}><dt>Eje {axis}</dt><dd>{value(reading?.[`${prefix}${axis}` as 'accelX'])}</dd></div>)}</dl></div>)}
      <div><h3>Temperatura MPU6050</h3><strong className="temperature">{value(reading?.temperature)}{reading?.temperature != null && ' °C'}</strong><p className="caption">Lectura del módulo MPU6050.</p></div>
    </div></section>;
}
