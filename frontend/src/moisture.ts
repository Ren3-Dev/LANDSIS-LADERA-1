// Referencias experimentales confirmadas por el usuario: seco/aire 4095; agua 0.
// Porcentaje relativo del sensor, no contenido volumétrico de agua del suelo.
export function moisturePercent(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isInteger(raw) || raw < 0 || raw > 4095) return null;
  return (4095 - raw) / 4095 * 100;
}
export function formatMoisture(raw: number | null | undefined): string {
  const percent = moisturePercent(raw);
  return percent == null ? 'Sin lectura' : Math.round(percent) + ' %';
}
