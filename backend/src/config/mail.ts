import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface MailConfig { from: string; smtp: SMTPTransport.Options }

// Una dirección simple por mensaje; no aceptar listas ni cabeceras adicionales.
export function validMailbox(value: string): boolean {
  return value.length <= 254 && !/[\x00-\x1f\x7f]/.test(value)
    && /^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(value);
}

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const invalid = () => new Error('Configuración de correo inválida. Revisa las variables SMTP y MAIL_FROM.');
  const host = env.SMTP_HOST?.trim();
  const portText = env.SMTP_PORT ?? '';
  const port = Number(portText);
  const secureText = env.SMTP_SECURE;
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const from = env.MAIL_FROM?.trim();
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || host.length > 253
    || !/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535
    || !['true', 'false'].includes(secureText ?? '')
    || !user || /[\r\n\0]/.test(user) || !pass?.trim() || /[\r\n\0]/.test(pass)
    || !from || !validMailbox(from)) throw invalid();
  const secure = secureText === 'true';
  if ((port === 465 && !secure) || (port === 587 && secure)) throw invalid();
  return {
    from,
    smtp: {
      host, port, secure, requireTLS: !secure, ignoreTLS: false,
      auth: { user, pass }, tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      dnsTimeout: 10000, logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true,
    },
  };
}
