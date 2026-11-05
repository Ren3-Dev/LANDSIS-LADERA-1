import type { PersistedReading } from '../data/readings.js';
import type { Orientation } from '../readings/orientation.js';
export type AlertReading = PersistedReading & { orientation?: Orientation };
export type CommittedReadingObserver = (reading: AlertReading) => void;
export type AlertSignal = 'critical' | 'normal' | 'other';
export interface DeliveryCounts { accepted: number; failed: number; skipped: number }
export interface AlertStateStore {
  claim(reading: AlertReading, signal: AlertSignal): Promise<boolean>;
  finish(nodeId: string, readingId: number, counts: DeliveryCounts): Promise<void>;
  fail(nodeId: string, readingId: number): Promise<void>;
}
