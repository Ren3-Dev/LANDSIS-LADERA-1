import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { validName, validEmail } from './auth/user.js';
import { validPassword } from './auth/password.js';
import { createInitialAdmin } from './auth/bootstrap.js';
import { getPool } from './data/postgres.js';
import { hiddenPassword } from './auth/terminal.js';

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('TTY required');
  const prompt = createInterface({ input: stdin, output: stdout });
  const name = (await prompt.question('Nombre del administrador: ')).trim();
  const email = (await prompt.question('Correo: ')).trim().toLowerCase();
  prompt.close();
  if (!validName(name) || !validEmail(email)) { stdout.write('Nombre o correo inválido.\n'); process.exitCode = 1; return; }
  const password = await hiddenPassword('Contraseña (12–128 caracteres; entrada oculta): ');
  const confirmation = await hiddenPassword('Confirmar contraseña: ');
  if (!validPassword(password) || password !== confirmation) { stdout.write('Contraseña inválida o confirmación diferente.\n'); process.exitCode = 1; return; }
  try {
    const created = await createInitialAdmin({ name, email, password });
    stdout.write(created ? 'Administrador inicial creado.\n' : 'Ya existe un administrador. No se modificó ninguna cuenta.\n');
    if (!created) process.exitCode = 1;
  } finally { await getPool().end(); }
}
main().catch(() => { console.error('No se pudo crear el administrador. Usa una terminal interactiva y verifica la migración y configuración local; no se muestran detalles ni credenciales.'); process.exitCode = 1; });

