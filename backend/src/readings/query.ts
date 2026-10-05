export interface ReadingFilters { nodeId?: string; from?: string; to?: string }

// Contrato ISO: segundos obligatorios, fracción opcional de 1–3 dígitos y zona explícita.
function validTimestamp(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)
    && Number(parts[4]) <= 23 && Number(parts[5]) <= 59 && Number(parts[6]) <= 59
    && (parts[7] === 'Z' || (Number(parts[8]) <= 23 && Number(parts[9]) <= 59))
    && Number.isFinite(Date.parse(value));
}

export function parseReadingQuery(query: Record<string, unknown>, latest = false): { limit: number; filters: ReadingFilters } {
  const allowed = latest ? ['nodeId'] : ['nodeId', 'from', 'to', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) throw new Error('Parámetro de consulta no admitido.');
  const filters: ReadingFilters = {};
  if (query.nodeId !== undefined) {
    if (typeof query.nodeId !== 'string' || !query.nodeId.trim()) throw new Error('nodeId debe ser un string no vacío.');
    filters.nodeId = query.nodeId;
  }
  for (const key of ['from', 'to'] as const) {
    const value = query[key];
    if (value !== undefined) {
      if (typeof value !== 'string' || !validTimestamp(value)) throw new Error(`${key} debe ser una fecha/hora ISO válida con zona explícita.`);
      filters[key] = value;
    }
  }
  if (filters.from && filters.to && Date.parse(filters.from) >= Date.parse(filters.to)) throw new Error('from debe ser anterior a to.');
  let limit = latest ? 1 : 50;
  if (query.limit !== undefined) {
    const value = query.limit;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100) throw new Error('limit debe ser un entero entre 1 y 100.');
    limit = Number(value);
  }
  return { limit, filters };
}
