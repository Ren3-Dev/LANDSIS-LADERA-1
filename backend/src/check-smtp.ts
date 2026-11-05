import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import dotenv from 'dotenv';
import path from 'node:path';
import { loadMailConfig } from './config/mail.js';
import { loadRecoveryConfig } from './config/recovery.js';

interface CheckTransport { verify(): Promise<unknown>; close(): void }
type CheckFailure = 'CONFIGURATION' | 'AUTHENTICATION' | 'TLS' | 'CONNECTION' | 'UNKNOWN';
const safeCodes = new Set(['EAUTH', 'ETLS', 'EDNS', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER']);
const tlsCodes = new Set(['ETLS', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER']);
type Stage = 'CONFIGURATION' | 'CONNECTION' | 'TLS' | 'AUTHENTICATION' | 'SMTP' | 'VERIFY';
interface Diagnostic { code: string; stage: Stage; command?: string; responseCode?: number }
export class SmtpCheckError extends Error {
  constructor(public readonly category: CheckFailure, public readonly diagnostic: Diagnostic = { code: 'UNKNOWN', stage: 'VERIFY' }) {
    super('No se completó la comprobación SMTP. No se muestran credenciales ni errores internos.');
    this.name = 'SmtpCheckError';
  }
}

// Diagnóstico del mismo transporte/configuración que utiliza el servicio actual.
// No expone sendMail ni activa rutas, sesiones, PostgreSQL o recuperación.
export async function checkSmtp(
  env: NodeJS.ProcessEnv,
  connect = false,
  factory: (options: SMTPTransport.Options) => CheckTransport = options => nodemailer.createTransport(options),
) {
  let config;
  try {
    config = loadMailConfig(env);
    if (config.smtp.host !== 'smtp.gmail.com' || config.smtp.port !== 465 || config.smtp.secure !== true) throw new Error();
    if (loadRecoveryConfig(env).emailEnabled) throw new Error();
    // Solo validar la URL; esta copia no cambia process.env ni habilita envíos.
    loadRecoveryConfig({ ...env, RECOVERY_EMAIL_ENABLED: 'true' });
  } catch { throw new SmtpCheckError('CONFIGURATION', { code: 'CONFIGURATION', stage: 'CONFIGURATION' }); }
  if (!connect) return { configurationValid: true, connectionChecked: false, messagesSent: 0 };

  let transport: CheckTransport | undefined;
  try {
    transport = factory(config.smtp);
    if (await transport.verify() !== true) throw new SmtpCheckError('CONNECTION');
    return { configurationValid: true, connectionChecked: true, messagesSent: 0 };
  } catch (error: unknown) {
    if (error instanceof SmtpCheckError) throw error;
    const fields = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    const code = typeof fields.code === 'string' && safeCodes.has(fields.code) ? fields.code : 'UNKNOWN';
    // Nunca copiar message, response, stack, cause ni argumentos de AUTH.
    const command = typeof fields.command === 'string' && /^AUTH(?: |$)/.test(fields.command) ? 'AUTH'
      : typeof fields.command === 'string' && ['CONN', 'STARTTLS', 'EHLO', 'HELO', 'QUIT'].includes(fields.command) ? fields.command : undefined;
    const category: CheckFailure = code === 'EAUTH' ? 'AUTHENTICATION'
      : tlsCodes.has(code) || command === 'STARTTLS' ? 'TLS'
      : ['EDNS', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code) ? 'CONNECTION' : 'UNKNOWN';
    const diagnostic: Diagnostic = { code, stage: category === 'AUTHENTICATION' || command === 'AUTH' ? 'AUTHENTICATION'
      : category === 'TLS' ? 'TLS' : command === 'CONN' || category === 'CONNECTION' ? 'CONNECTION' : command ? 'SMTP' : 'VERIFY' };
    if (command) diagnostic.command = command;
    if (typeof fields.responseCode === 'number' && Number.isInteger(fields.responseCode) && fields.responseCode >= 100 && fields.responseCode <= 599) diagnostic.responseCode = fields.responseCode;
    throw new SmtpCheckError(category, diagnostic);
  } finally {
    try { transport?.close(); } catch { /* No exponer errores del transporte al cerrar. */ }
  }
}

if (require.main === module) {
  // Resolver backend/.env desde src/ o dist/, sin depender del directorio actual.
  // dotenv conserva las variables ya presentes en el proceso (override=false).
  const loaded = dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--verify-connection') || args.length > 1) {
    console.error('Uso: npm run smtp -- [--verify-connection]. Sin esa opción no hay conexión externa.');
    process.exitCode = 1;
  } else {
    (loaded.error ? Promise.reject(new SmtpCheckError('CONFIGURATION', { code: 'CONFIGURATION', stage: 'CONFIGURATION' })) : checkSmtp(process.env, args.includes('--verify-connection')))
      .then(result => { console.log(JSON.stringify(result)); })
      .catch((error: unknown) => {
        const safe = error instanceof SmtpCheckError ? error : new SmtpCheckError('UNKNOWN');
        console.error(JSON.stringify({ category: safe.category, ...safe.diagnostic })); process.exitCode = 1;
      });
  }
}
