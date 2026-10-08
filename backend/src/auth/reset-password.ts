import { hashPassword, validPassword } from './password.js';
import { validEmail } from './user.js';
import { getPool } from '../data/postgres.js';

export async function resetPassword(email: string, password: string): Promise<boolean> {
  if (!validEmail(email)) throw new Error('Correo inválido.');
  if (!validPassword(password)) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  const hash = await hashPassword(password);
  // La sal está incluida en password_hash. No leer hashes ni alterar otros campos.
  const result = await getPool().query(
    'UPDATE users SET password_hash=$1 WHERE email=$2',
    [hash, email.trim().toLowerCase()],
  );
  return result.rowCount === 1;
}
