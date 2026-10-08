import type { Reading } from '../types/telemetry';
const value = (v: number | null | undefined) => v == null ? 'Sin lectura' : String(v);

export default function MpuPanel({ reading }: { reading: Reading | null }) {
  return <section className="panel"><div className="section-heading"><h2>Telemetría MPU6050</h2><span className="tag">Experimental · sin calibrar</span></div>
    <p className="caption">Valores recibidos del nodo. No se calcula inclinación ni desplazamiento; unidades de aceleración y giroscopio pendientes de documentación.</p>
    <div className="mpu-grid">{[['Aceleración', 'accel'], ['Giroscopio', 'gyro']].map(([label, prefix]) => <div key={prefix}><h3>{label}</h3><dl>{['X', 'Y', 'Z'].map(axis => <div key={axis}><dt>Eje {axis}</dt><dd>{value(reading?.[`${prefix}${axis}` as 'accelX'])}</dd></div>)}</dl></div>)}
      <div><h3>Temperatura MPU6050</h3><strong className="temperature">{value(reading?.temperature)}</strong><p className="caption">Lectura del sensor MPU6050.</p></div>
    </div></section>;
}
