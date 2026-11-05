import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, validPassword } from './password.js';
import { passwordResetStore, type PasswordResetStore } from '../data/password-resets.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

// El token solo sale al servicio interno que prepara el correo,
// autorizado para construir el futuro enlace; nunca se registra ni persiste.
export function createPasswordRecovery(store: PasswordResetStore = passwordResetStore) {
  return {
    async issue(userId: number): Promise<string | null> {
      if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Usuario inválido.');
      const token = randomBytes(32).toString('hex');
      return await store.issue(userId, digest(token)) ? token : null;
    },
    async reset(token: string, password: string): Promise<boolean> {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
      if (!validPassword(password)) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
      const hash = await hashPassword(password);
      return store.consume(digest(token), hash);
    },
  };
}
