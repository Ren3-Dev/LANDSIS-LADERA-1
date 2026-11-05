import { getPool } from './postgres.js';
import { publicUser, type AccountUser, type PrivateUser, type User, type NewUser, type UserPatch } from '../auth/user.js';
export interface UserStore {
  findByEmail(email: string): Promise<PrivateUser | null>;
  findById(id: number): Promise<AccountUser | null>;
  list(): Promise<User[]>;
  create(input: Omit<NewUser, 'password'>, hash: string): Promise<User>;
  patch(id: number, patch: UserPatch): Promise<User | null>;
  remove(id: number, actorId: number): Promise<boolean>;
}
export class UserConflict extends Error {}
export class LastAdmin extends Error {}
export class SelfDeletion extends Error {}
export class AdminDeletion extends Error {}
const columns = 'u.id, u.name, u.email, r.name AS role, u.active, u.created_at AS "createdAt", u.credential_version AS "credentialVersion"';
function map(row: User): User { return publicUser({ ...row, createdAt: new Date(row.createdAt).toISOString() }); }
export const userStore: UserStore = {
  async findByEmail(email) {
    const result = await getPool().query<PrivateUser>(`SELECT ${columns}, u.password_hash AS "passwordHash" FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=$1 AND u.deleted_at IS NULL`, [email]);
    const row = result.rows[0]; return row ? { ...map(row), credentialVersion: row.credentialVersion, passwordHash: row.passwordHash } : null;
  },
  async findById(id) {
    const result = await getPool().query<AccountUser>(`SELECT ${columns} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.deleted_at IS NULL`, [id]);
    const row = result.rows[0];
    return row ? { ...map(row), credentialVersion: row.credentialVersion } : null;
  },
  async list() {
    const result = await getPool().query<User>(`SELECT ${columns} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.deleted_at IS NULL ORDER BY u.id`);
    return result.rows.map(map);
  },
  async create(input, hash) {
    try {
      const result = await getPool().query<{ id: number }>(`INSERT INTO users (name,email,password_hash,role_id,active) VALUES ($1,$2,$3,(SELECT id FROM roles WHERE name=$4),$5) RETURNING id`, [input.name, input.email, hash, input.role, input.active]);
      return (await this.findById(result.rows[0]!.id))!;
    } catch (error) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new UserConflict(); throw error; }
  },
  async patch(id, patch) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Serializar cambios de rol/estado para no desactivar al último administrador activo.
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const current = await client.query<User>(`SELECT ${columns} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.deleted_at IS NULL`, [id]);
      const user = current.rows[0];
      if (!user) { await client.query('COMMIT'); return null; }
      if (user.role === 'ADMINISTRADOR' && user.active && (patch.active === false || (patch.role && patch.role !== 'ADMINISTRADOR'))) {
        const admins = await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE u.active AND u.deleted_at IS NULL AND r.name='ADMINISTRADOR'`);
        if (admins.rows.length <= 1) throw new LastAdmin();
      }
      await client.query(`UPDATE users SET name=$2, role_id=(SELECT id FROM roles WHERE name=$3), active=$4 WHERE id=$1`, [id, patch.name ?? user.name, patch.role ?? user.role, patch.active ?? user.active]);
      const updated = await client.query<User>(`SELECT ${columns} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`, [id]);
      await client.query('COMMIT'); return map(updated.rows[0]!);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
  async remove(id, actorId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Mismo bloqueo que PATCH: serializa eliminación, cambios de rol y estado.
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const current = await client.query<User>(`SELECT ${columns} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.deleted_at IS NULL`, [id]);
      const user = current.rows[0];
      if (!user) { await client.query('COMMIT'); return false; }
      if (id === actorId) throw new SelfDeletion();
      if (user.role === 'ADMINISTRADOR') throw new AdminDeletion();
      await client.query('UPDATE users SET deleted_at=clock_timestamp(), credential_version=credential_version+1 WHERE id=$1', [id]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [id]);
      await client.query('COMMIT'); return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
};
