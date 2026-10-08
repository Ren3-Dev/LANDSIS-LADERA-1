import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// N=2^17, r=8, p=1; salt/hash y parámetros se conservan en una sola cadena.
const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && [...value].length >= 12 && [...value].length <= 128 && value.trim().length > 0;
}
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  const salt = randomBytes(16);
  return `scrypt$131072$8$1$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$131072$8$1'
    || !/^[a-f0-9]{32}$/.test(parts[4] ?? '') || !/^[a-f0-9]{128}$/.test(parts[5] ?? '')) return false;
  const key = await derive(password, Buffer.from(parts[4]!, 'hex'));
  return timingSafeEqual(key, Buffer.from(parts[5]!, 'hex'));
}
