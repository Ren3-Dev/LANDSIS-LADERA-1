import type { Reading } from '../types/telemetry';

export default function MoistureChart({ readings }: { readings: Reading[] }) {
  if (!readings.length) return <p className="empty">No hay lecturas para graficar.</p>;
  const ordered = [...readings].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.id - b.id);
  const first = Date.parse(ordered[0].receivedAt);
  const last = Date.parse(ordered[ordered.length - 1].receivedAt);
  const x = (r: Reading) => last === first ? 480 : 65 + (Date.parse(r.receivedAt) - first) / (last - first) * 835;
  const y = (r: Reading) => 230 - r.soilMoistureRaw / 4095 * 205;
  const time = (r: Reading) => new Date(r.receivedAt).toLocaleTimeString('es-GT');
  return <><svg viewBox="0 0 940 280" role="img" aria-label={`Humedad RAW ADC: ${ordered.length} lecturas cronológicas, escala de 0 a 4095.`}>
    <text x="14" y="14" className="axis">RAW ADC</text>
    {[0, 1024, 2048, 3072, 4095].map(v => <g key={v}><line x1="65" x2="900" y1={230 - v / 4095 * 205} y2={230 - v / 4095 * 205} className="gridline"/><text x="53" y={235 - v / 4095 * 205} textAnchor="end" className="axis">{v}</text></g>)}
    <polyline points={ordered.map(r => `${x(r)},${y(r)}`).join(' ')} fill="none" className="chart-line" strokeWidth="3"/>
    {ordered.map(r => <circle key={r.id} cx={x(r)} cy={y(r)} r="3" className="chart-point"><title>{`${time(r)} · RAW ${r.soilMoistureRaw}`}</title></circle>)}
    <text x="65" y="257" className="axis">{time(ordered[0])}</text><text x="900" y="257" textAnchor="end" className="axis">{time(ordered[ordered.length - 1])}</text>
  </svg><p className="caption">Tiempo de recepción · hora local del navegador. Valores ADC originales, sin calibración ni conversión a porcentaje.</p></>;
}


