import { getPool } from '../data/postgres.js';
import type { AlertStateStore } from './types.js';

export const alertStateStore: AlertStateStore = {
  async claim(reading, signal) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO inclination_email_state (node_id) VALUES ($1) ON CONFLICT (node_id) DO NOTHING', [reading.nodeId]);
      const result = await client.query<{ last_reading_id: number | null; critical_active: boolean }>(
        'SELECT last_reading_id, critical_active FROM inclination_email_state WHERE node_id=$1 FOR UPDATE', [reading.nodeId]);
      const state = result.rows[0]!;
      if (state.last_reading_id !== null && state.last_reading_id >= reading.id) { await client.query('COMMIT'); return false; }
      const claimed = signal === 'critical' && !state.critical_active;
      if (claimed) {
        await client.query(`UPDATE inclination_email_state SET last_reading_id=$2, critical_active=true,
          last_event_reading_id=$2, delivery_status='pending', accepted_count=0, failed_count=0, skipped_count=0,
          updated_at=clock_timestamp() WHERE node_id=$1`, [reading.nodeId, reading.id]);
      } else {
        await client.query('UPDATE inclination_email_state SET last_reading_id=$2, critical_active=$3, updated_at=clock_timestamp() WHERE node_id=$1',
          [reading.nodeId, reading.id, signal === 'normal' ? false : state.critical_active]);
      }
      await client.query('COMMIT');
      return claimed;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
  async finish(nodeId, readingId, counts) {
    const total = counts.accepted + counts.failed + counts.skipped;
    const status = total === 0 ? 'no_recipients' : counts.accepted === 0 ? 'failed'
      : counts.failed || counts.skipped ? 'partial' : 'sent';
    await getPool().query(`UPDATE inclination_email_state SET delivery_status=$3, accepted_count=$4,
      failed_count=$5, skipped_count=$6, updated_at=clock_timestamp() WHERE node_id=$1 AND last_event_reading_id=$2`,
      [nodeId, readingId, status, counts.accepted, counts.failed, counts.skipped]);
  },
  async fail(nodeId, readingId) {
    await getPool().query("UPDATE inclination_email_state SET delivery_status='failed', updated_at=clock_timestamp() WHERE node_id=$1 AND last_event_reading_id=$2", [nodeId, readingId]);
  },
};
