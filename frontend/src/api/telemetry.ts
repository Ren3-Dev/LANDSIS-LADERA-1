import { mpuFields, type Node, type Reading } from '../types/telemetry';
import { apiRequest } from './http';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNode(value: unknown): value is Node {
  return object(value) && typeof value.nodeId === 'string' && value.nodeId.trim().length > 0;
}
function isReading(value: unknown): value is Reading {
  if (!object(value) || !isNode(value)) return false;
  const r = value as unknown as Record<string, unknown>;
  return Number.isSafeInteger(r.id) && typeof r.soilMoistureRaw === 'number'
    && Number.isInteger(r.soilMoistureRaw) && r.soilMoistureRaw >= 0 && r.soilMoistureRaw <= 4095
    && typeof r.vibrationDetected === 'boolean' && typeof r.receivedAt === 'string'
    && Number.isFinite(Date.parse(r.receivedAt))
    && (mpuFields.every(k => r[k] === null) || mpuFields.every(k => typeof r[k] === 'number' && Number.isFinite(r[k])));
}
async function request(path: string, signal: AbortSignal, allowEmpty = false): Promise<unknown> {
  const response = await apiRequest(path, { signal });
  if (allowEmpty && response.status === 404) return null;
  if (!response.ok) throw new Error('API unavailable');
  return response.json();
}
export async function getNodes(signal: AbortSignal): Promise<Node[]> {
  const data = await request('nodes', signal);
  if (!object(data) || !Array.isArray(data.nodes) || !data.nodes.every(isNode)) throw new Error('Invalid nodes');
  return data.nodes;
}
export async function getLatest(nodeId: string, signal: AbortSignal): Promise<Reading | null> {
  const data = await request(`readings/latest?${new URLSearchParams({ nodeId })}`, signal, true);
  if (data === null) return null;
  if (!object(data) || !isReading(data.reading) || data.reading.nodeId !== nodeId) throw new Error('Invalid reading');
  return data.reading;
}
export async function getHistory(nodeId: string, signal: AbortSignal, filters: { limit: number; from?: string; to?: string } = { limit: 50 }): Promise<Reading[]> {
  const query = new URLSearchParams({ nodeId, limit: String(filters.limit) });
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  const data = await request(`readings?${query}`, signal);
  if (!object(data) || !Array.isArray(data.readings) || !data.readings.every(isReading)
    || !data.readings.every(r => r.nodeId === nodeId)) throw new Error('Invalid history');
  return data.readings;
}

