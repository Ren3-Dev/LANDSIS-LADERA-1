import type { Pool, PoolClient } from 'pg';
import { getPool } from './postgres.js';

export interface PasswordResetStore {
  issue(userId: number, tokenHash: string): Promise<boolean>;
  consume(tokenHash: string, passwordHash: string): Promise<boolean>;
  resetLocal(email: string, passwordHash: string): Promise<boolean>;
}

export function createPasswordResetStore(pool: () => Pick<Pool, 'connect'> = () => getPool()): PasswordResetStore {
  async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool().connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      // Compatible con el bloqueo de tabla de PATCH/bootstrap: adquirir el modo
      // de escritura antes del bloqueo de fila evita invertir ese orden.
      // ROW EXCLUSIVE permite otras operaciones de recuperación concurrentes.
      await client.query('LOCK TABLE users IN ROW EXCLUSIVE MODE');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally { client.release(discard); }
  }

  return {
    issue(userId, tokenHash) {
      return transaction(async client => {
        const user = await client.query('SELECT id FROM users WHERE id=$1 AND active AND deleted_at IS NULL FOR UPDATE', [userId]);
        if (!user.rows.length) return false;
        await client.query(`WITH issued AS (SELECT clock_timestamp() AS at)
          INSERT INTO password_reset_tokens (user_id, token_hash, created_at, expires_at)
          SELECT $1, $2, at, at + INTERVAL '15 minutes' FROM issued
          ON CONFLICT (user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,
            created_at=EXCLUDED.created_at, expires_at=EXCLUDED.expires_at`, [userId, tokenHash]);
        return true;
      });
    },
    consume(tokenHash, passwordHash) {
      return transaction(async client => {
        // Solo localizar: no bloquear primero el token (orden usuario -> token).
        const token = await client.query<{ user_id: number }>('SELECT user_id FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
        const id = token.rows[0]?.user_id;
        if (id === undefined) return false;
        const user = await client.query('SELECT id FROM users WHERE id=$1 AND active AND deleted_at IS NULL FOR UPDATE', [id]);
        if (!user.rows.length) return false;
        // Revalidar hash y tiempo DESPUÉS de esperar el bloqueo; now() conserva
        // la hora de BEGIN y aceptaría tokens vencidos durante esa espera.
        const consumed = await client.query(`DELETE FROM password_reset_tokens
          WHERE user_id=$1 AND token_hash=$2 AND expires_at > clock_timestamp() RETURNING user_id`, [id, tokenHash]);
        if (!consumed.rows.length) return false;
        await client.query('UPDATE users SET password_hash=$1, credential_version=credential_version+1 WHERE id=$2', [passwordHash, id]);
        return true;
      });
    },
    resetLocal(email, passwordHash) {
      return transaction(async client => {
        // UPDATE adquiere el bloqueo de usuario antes de eliminar su token.
        const updated = await client.query<{ id: number }>(
          'UPDATE users SET password_hash=$1, credential_version=credential_version+1 WHERE email=$2 AND deleted_at IS NULL RETURNING id',
          [passwordHash, email],
        );
        const id = updated.rows[0]?.id;
        if (id === undefined) return false;
        await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [id]);
        return true;
      });
    },
  };
}

export const passwordResetStore = createPasswordResetStore();
