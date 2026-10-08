import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { validEmail } from './auth/user.js';
import { validPassword } from './auth/password.js';
import { hiddenPassword } from './auth/terminal.js';
import { resetPassword } from './auth/reset-password.js';
import { getPool } from './data/postgres.js';

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('TTY required');
  const prompt = createInterface({ input: stdin, output: stdout });
  const email = (await prompt.question('Correo del usuario existente: ')).trim().toLowerCase();
  prompt.close();
  if (!validEmail(email)) { stdout.write('Correo inválido.\n'); process.exitCode = 1; return; }
  const password = await hiddenPassword('Nueva contraseña (12–128 caracteres; entrada oculta): ');
  const confirmation = await hiddenPassword('Confirmar nueva contraseña: ');
  if (!validPassword(password) || password !== confirmation) {
    stdout.write('Contraseña inválida o confirmación diferente. No se modificó ninguna cuenta.\n');
    process.exitCode = 1; return;
  }
  try {
    const updated = await resetPassword(email, password);
    stdout.write(updated ? 'Contraseña restablecida correctamente.\n' : 'No existe un usuario con ese correo. No se modificó ninguna cuenta.\n');
    if (!updated) process.exitCode = 1;
  } finally { await getPool().end(); }
}
main().catch(() => {
  console.error('No se completó el restablecimiento. Usa una terminal interactiva y verifica la conexión local. No se muestran detalles ni credenciales.');
  process.exitCode = 1;
});
