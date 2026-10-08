import type { NewUser } from './user.js';
import { hashPassword } from './password.js';
import { getPool } from '../data/postgres.js';

export async function createInitialAdmin(input: Pick<NewUser, 'name' | 'email' | 'password'>): Promise<boolean> {
  const hash = await hashPassword(input.password);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const exists = await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='ADMINISTRADOR' LIMIT 1`);
    if (exists.rows.length) { await client.query('ROLLBACK'); return false; }
    await client.query(`INSERT INTO users (name,email,password_hash,role_id,active) VALUES ($1,$2,$3,(SELECT id FROM roles WHERE name='ADMINISTRADOR'),TRUE)`, [input.name, input.email, hash]);
    await client.query('COMMIT'); return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
