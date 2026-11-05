import { hashPassword, validPassword } from './password.js';
import { validEmail } from './user.js';
import { passwordResetStore } from '../data/password-resets.js';

export async function resetPassword(email: string, password: string): Promise<boolean> {
  if (!validEmail(email)) throw new Error('Correo inválido.');
  if (!validPassword(password)) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  const hash = await hashPassword(password);
  // Cambiar hash, incrementar versión y eliminar enlaces pendientes atómicamente.
  return passwordResetStore.resetLocal(email.trim().toLowerCase(), hash);
}
