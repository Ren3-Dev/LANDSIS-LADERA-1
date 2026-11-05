import { Router, json, type RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { isObject, validEmail } from '../auth/user.js';
import { validPassword } from '../auth/password.js';
import { createPasswordRecovery } from '../auth/password-recovery.js';
import { RecoveryLimit, RecoveryQueue } from '../auth/recovery-limits.js';
import { userStore, type UserStore } from '../data/users.js';
import type { MailService } from '../mail/service.js';
import { loadRecoveryConfig } from '../config/recovery.js';

export interface RecoveryOptions {
  users?: Pick<UserStore, 'findByEmail'>;
  recovery?: ReturnType<typeof createPasswordRecovery>;
  mail?: Pick<MailService, 'sendPasswordRecovery'>;
  frontendUrl?: string;
  now?: () => number;
  onFailure?: () => void;
}
const generic = { message: 'Si la cuenta puede recuperarse, recibirás un correo con instrucciones.' };
const invalidToken = { message: 'El enlace de recuperación no es válido o ha vencido.' };
const key = (value: string) => createHash('sha256').update(value).digest('hex');

export function createRecoveryRouter(options: RecoveryOptions, mutation: RequestHandler) {
  const users = options.users ?? userStore, recovery = options.recovery ?? createPasswordRecovery();
  // Validar también dependencias inyectadas: nunca tomar origen de Host/Forwarded.
  const frontend = options.mail ? loadRecoveryConfig({ RECOVERY_EMAIL_ENABLED: 'true', FRONTEND_URL: options.frontendUrl,
    NODE_ENV: process.env.NODE_ENV }).frontendUrl! : undefined;
  const queue = new RecoveryQueue(options.onFailure);
  const forgotIp = new RecoveryLimit(5, options.now), account = new RecoveryLimit(3, options.now);
  const resetIp = new RecoveryLimit(10, options.now), resetToken = new RecoveryLimit(5, options.now);
  let resetting = 0;
  const router = Router();
  const ipLimit = (limit: RecoveryLimit): RequestHandler => (req, res, next) => {
    if (!limit.take(req.ip ?? 'unknown')) {
      res.set('Retry-After', '900').status(429).json({ message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }); return;
    }
    next();
  };
  router.post('/forgot-password', mutation, ipLimit(forgotIp), json({ limit: '8kb' }), (req, res) => {
    const input: unknown = req.body;
    if (!isObject(input) || Object.keys(input).length !== 1 || !validEmail(input.email)) {
      res.status(400).json({ message: 'Introduce un correo válido.' }); return;
    }
    const email = input.email.trim().toLowerCase();
    const allowed = account.take(key(email));
    res.status(202).json(generic);
    if (!allowed || !options.mail || !frontend) return;
    queue.enqueue(async () => {
      const user = await users.findByEmail(email);
      if (!user?.active) return;
      const token = await recovery.issue(user.id);
      if (!token) return;
      const url = new URL('reset-password', frontend);
      url.hash = new URLSearchParams({ token }).toString();
      await options.mail!.sendPasswordRecovery(user.email, { name: user.name, resetUrl: url.href });
    });
  });
  router.post('/reset-password', mutation, ipLimit(resetIp), json({ limit: '8kb' }), async (req, res) => {
    const input: unknown = req.body;
    if (!isObject(input) || Object.keys(input).length !== 2 || typeof input.token !== 'string'
      || !/^[a-f0-9]{64}$/.test(input.token) || !validPassword(input.password)) {
      res.status(400).json({ message: 'Introduce un token válido y una contraseña de 12 a 128 caracteres.' }); return;
    }
    if (!resetToken.take(key(input.token)) || resetting >= 2) {
      res.set('Retry-After', '900').status(429).json({ message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }); return;
    }
    resetting++;
    try {
      if (!await recovery.reset(input.token, input.password)) { res.status(400).json(invalidToken); return; }
      res.json({ message: 'Contraseña restablecida. Inicia sesión con tu nueva contraseña.' });
    } catch {
      res.status(503).json({ message: 'No se pudo completar el restablecimiento. Intenta de nuevo.' });
    } finally { resetting--; }
  });
  return router;
}
