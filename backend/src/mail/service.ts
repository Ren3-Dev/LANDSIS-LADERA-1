import nodemailer from 'nodemailer';
import { loadMailConfig, validMailbox } from '../config/mail.js';
import { passwordChangedTemplate, passwordRecoveryTemplate, type MailContent } from './templates.js';

export interface MailMessage extends MailContent { to: string }
export interface OutgoingMail extends MailMessage { from: string }
export interface MailTransport {
  sendMail(message: OutgoingMail): Promise<unknown>;
}
// Punto de extensión para futuras alertas; no define riesgo ni destinatarios.
export interface MailService {
  send(message: MailMessage): Promise<void>;
  sendPasswordRecovery(to: string, input: { name: string; resetUrl: string }): Promise<void>;
  sendPasswordChanged(to: string, input: { name: string }): Promise<void>;
}
export class MailDeliveryError extends Error {
  constructor() { super('No se pudo enviar el correo.'); this.name = 'MailDeliveryError'; }
}

export function createMailService(transport: MailTransport, from: string): MailService {
  if (!validMailbox(from)) throw new Error('Remitente de correo inválido.');
  const send = async (message: MailMessage): Promise<void> => {
    if (!validMailbox(message.to) || !message.subject.trim() || /[\r\n\0]/.test(message.subject)
      || !message.text.trim() || !message.html.trim()) throw new Error('Mensaje de correo inválido.');
    try {
      // Lista explícita: no transmitir campos adicionales, adjuntos o cabeceras.
      const result = await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
      if (typeof result === 'object' && result !== null && 'rejected' in result
        && Array.isArray(result.rejected) && result.rejected.length > 0) throw new MailDeliveryError();
    } catch {
      // No adjuntar el error SMTP: podría contener credenciales o contenido.
      throw new MailDeliveryError();
    }
  };
  return {
    send,
    sendPasswordRecovery: (to, input) => send({ to, ...passwordRecoveryTemplate(input) }),
    sendPasswordChanged: (to, input) => send({ to, ...passwordChangedTemplate(input) }),
  };
}

// Construcción explícita y diferida: importar este módulo no lee .env ni conecta.
export function createSmtpMailService(env: NodeJS.ProcessEnv = process.env): MailService {
  const config = loadMailConfig(env);
  return createMailService(nodemailer.createTransport(config.smtp), config.from);
}
