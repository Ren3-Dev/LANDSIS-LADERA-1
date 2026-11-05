import { formatMoisture } from '../moisture';
import type { Reading } from '../types/telemetry';
import { formatVibration } from '../presentation';

const day = new Intl.DateTimeFormat('es-GT', { timeZone:'America/Guatemala', dateStyle:'medium' });
const time = new Intl.DateTimeFormat('es-GT', { timeZone:'America/Guatemala', timeStyle:'medium' });
export default function DailyReadings({ readings }: { readings: Reading[] }) {
  return <section className="panel daily-readings" aria-labelledby="daily-readings-title"><div className="section-heading"><h2 id="daily-readings-title">Mediciones diarias</h2><span className="tag">{readings.length} {readings.length === 1 ? 'día con datos' : 'días con datos'}</span></div>
    <p className="caption">Una medición real por día: la última recibida del nodo dentro del intervalo consultado. Fecha y hora de Guatemala. Los días sin datos se omiten.</p>
    {readings.length ? <div className="table-scroll"><table><thead><tr>{['Día','Hora de recepción','Humedad (%) / RAW','Vibración'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{readings.map(reading => <tr key={reading.id}><td><time dateTime={reading.receivedAt}>{day.format(new Date(reading.receivedAt))}</time></td><td>{time.format(new Date(reading.receivedAt))}</td><td className="raw-cell">{formatMoisture(reading.soilMoistureRaw)} · RAW {reading.soilMoistureRaw}</td><td>{formatVibration(reading.vibrationDetected)}</td></tr>)}</tbody></table></div> : <p className="empty" role="status">No hay mediciones diarias para este nodo en el intervalo consultado.</p>}
  </section>;
}
