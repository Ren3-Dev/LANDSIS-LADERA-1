import { getLatest } from './telemetry';
import type { Reading } from '../types/telemetry';
import { LATEST_REFRESH_MS } from '../reception';

export function startLatestPolling(nodeId: string, callbacks: {
  onData: (reading: Reading | null) => void; onError: () => void;
}, read = getLatest, intervalMs = LATEST_REFRESH_MS) {
  let stopped = false;
  let inFlight: AbortController | null = null;
  async function refresh() {
    if (stopped || inFlight) return;
    const controller = new AbortController();
    inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const reading = await read(nodeId, controller.signal);
      if (!stopped && !controller.signal.aborted) callbacks.onData(reading);
    } catch {
      if (!stopped) callbacks.onError();
    } finally {
      clearTimeout(timeout);
      if (inFlight === controller) inFlight = null;
    }
  }
  void refresh();
  const interval = intervalMs > 0 ? setInterval(() => { void refresh(); }, intervalMs) : null;
  return {
    refresh,
    stop() { stopped = true; if (interval !== null) clearInterval(interval); inFlight?.abort(); },
  };
}
