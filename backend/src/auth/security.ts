import { Router, json, type Request, type RequestHandler, type ErrorRequestHandler } from 'express';
import { Sessions, sessionAgeSeconds } from './sessions.js';
import { hashPassword, verifyPassword } from './password.js';
import { isObject, validEmail, publicUser, parseNewUser, parseUserPatch, type Role, type User } from './user.js';
import { userStore, UserConflict, LastAdmin, type UserStore } from '../data/users.js';

const cookieName = 'landsis_session';
function cookieToken(req: Request): string {
  const parts = (req.headers.cookie ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName}=`));
  return parts.length === 1 ? parts[0]!.slice(cookieName.length + 1) : '';
}
export function requireRole(role: Role): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.user as User | undefined;
    if (!user) { res.status(401).json({ message: 'Debes iniciar sesión.' }); return; }
    if (user.role !== role) { res.status(403).json({ message: 'No tienes permiso para esta acción.' }); return; }
    next();
  };
}
export function createSecurity(store: UserStore = userStore, sessions = new Sessions()) {
  const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/api' };
  const requireAuth: RequestHandler = async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const token = cookieToken(req), id = sessions.userId(token);
    if (id === null) { res.status(401).json({ message: 'Debes iniciar sesión.' }); return; }
    try {
      const user = await store.findById(id);
      if (!user?.active) { sessions.delete(token); res.clearCookie(cookieName, cookieOptions); res.status(401).json({ message: 'La sesión ya no está disponible.' }); return; }
      res.locals.user = publicUser(user); next();
    } catch { res.status(503).json({ message: 'No se pudo verificar la sesión.' }); }
  };
  // Cabecera no simple: el navegador exige preflight para peticiones externas.
  // No habilitar CORS: combinar con cookie Strict y cuerpos exclusivamente JSON.
  const mutation: RequestHandler = (req, res, next) => {
    if (req.get('X-Landsis-Request') !== '1') { res.status(403).json({ message: 'Solicitud no permitida.' }); return; }
    if (!req.is('application/json')) { res.status(415).json({ message: 'Se requiere JSON.' }); return; }
    next();
  };
  const authRouter = Router(), usersRouter = Router();
  authRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Límite local y acotado: 10 intentos/15 min por IP; dos verificaciones simultáneas.
  const attempts = new Map<string, { count: number; expires: number }>();
  let busy = 0;
  const limitLogin: RequestHandler = (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const key = req.ip ?? 'unknown';
    const entry = attempts.get(key) ?? { count: 0, expires: now + 15 * 60 * 1000 };
    if (entry.count >= 10 || (!attempts.has(key) && attempts.size >= 1000)) { res.status(429).json({ message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' }); return; }
    entry.count++; attempts.set(key, entry); next();
  };
  authRouter.post('/login', mutation, limitLogin, json({ limit: '8kb' }), async (req, res) => {
    const input: unknown = req.body;
    if (!isObject(input) || Object.keys(input).length !== 2 || !validEmail(input.email) || typeof input.password !== 'string' || input.password.length > 512 || !input.password.length) {
      res.status(400).json({ message: 'Introduce un correo y una contraseña válidos.' }); return;
    }
    if (busy >= 2) { res.status(429).json({ message: 'El acceso está ocupado. Intenta de nuevo.' }); return; }
    busy++;
    try {
      const user = await store.findByEmail(input.email.trim().toLowerCase());
      const dummy = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      const valid = await verifyPassword(input.password, user?.passwordHash ?? dummy);
      if (!user || !valid) { res.status(401).json({ message: 'Correo o contraseña inválidos.' }); return; }
      if (!user.active) { res.status(403).json({ message: 'Tu usuario está inactivo. Contacta al administrador.' }); return; }
      sessions.delete(cookieToken(req));
      const token = sessions.create(user.id);
      res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionAgeSeconds * 1000 });
      res.status(200).json({ user: publicUser(user) });
    } catch { res.status(503).json({ message: 'No se pudo iniciar sesión. Intenta de nuevo.' }); }
    finally { busy--; }
  });
  authRouter.get('/me', requireAuth, (_req, res) => { res.json({ user: publicUser(res.locals.user as User) }); });
  authRouter.post('/logout', mutation, (_req, res) => {
    sessions.delete(cookieToken(_req)); res.clearCookie(cookieName, cookieOptions); res.status(204).end();
  });
  usersRouter.use(requireAuth, requireRole('ADMINISTRADOR'));
  usersRouter.get('/', async (_req, res) => {
    try { res.json({ users: (await store.list()).map(publicUser) }); }
    catch { res.status(503).json({ message: 'No se pudieron consultar los usuarios.' }); }
  });
  usersRouter.post('/', mutation, json({ limit: '8kb' }), async (req, res) => {
    const input = parseNewUser(req.body);
    if (!input) { res.status(400).json({ message: 'Datos inválidos. Nombre, correo, rol, estado y contraseña de 12 a 128 caracteres son obligatorios.' }); return; }
    try {
      const { password, ...fields } = input;
      res.status(201).json({ user: publicUser(await store.create(fields, await hashPassword(password))) });
    } catch (error) {
      if (error instanceof UserConflict) { res.status(409).json({ message: 'El correo ya está registrado.' }); return; }
      res.status(503).json({ message: 'No se pudo crear el usuario.' });
    }
  });
  usersRouter.patch('/:id', mutation, json({ limit: '8kb' }), async (req, res) => {
    const id = Number(req.params.id), patch = parseUserPatch(req.body);
    if (!/^[1-9]\d*$/.test(String(req.params.id)) || !Number.isSafeInteger(id) || !patch) { res.status(400).json({ message: 'Actualización inválida: solo nombre, rol y estado.' }); return; }
    try {
      const user = await store.patch(id, patch);
      if (!user) { res.status(404).json({ message: 'Usuario no encontrado.' }); return; }
      res.json({ user: publicUser(user) });
    } catch (error) {
      if (error instanceof LastAdmin) { res.status(409).json({ message: 'Debe quedar al menos un administrador activo.' }); return; }
      res.status(503).json({ message: 'No se pudo actualizar el usuario.' });
    }
  });
  const invalidJson: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (isObject(error) && (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')) {
      res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'El cuerpo JSON es inválido o demasiado grande.' }); return;
    } next(error);
  };
  authRouter.use(invalidJson); usersRouter.use(invalidJson);
  return { requireAuth, authRouter, usersRouter };
}
export type Security = ReturnType<typeof createSecurity>;
