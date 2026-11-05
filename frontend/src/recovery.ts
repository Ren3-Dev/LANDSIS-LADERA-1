import { jsonRequest } from './api/http';

export type RecoveryPage = 'login' | 'forgot' | 'complete';
export type RecoveryRoute = { page: RecoveryPage } | { page: 'reset'; token: string | null };
export const recoveryPaths = { login: '/', forgot: '/forgot-password', complete: '/reset-password' } as const;
export const recoveryMessage = 'Si la cuenta puede recuperarse, recibirás un correo con instrucciones.';

export function validRecoveryToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

// Invocar antes de montar React. El secreto se elimina también si está mal
// formado, repetido o llegó por query (solo se admite el fragmento).
export function readRecoveryLocation(browser: Pick<Window, 'location' | 'history'>): RecoveryRoute {
  const { pathname, hash } = browser.location;
  const path = pathname.replace(/\/$/, '');
  if (path === '/forgot-password') return { page: 'forgot' };
  if (path !== '/reset-password') return { page: 'login' };
  const params = new URLSearchParams(hash.slice(1));
  const value = params.get('token');
  const token = params.size === 1 && validRecoveryToken(value) ? value : null;
  browser.history.replaceState(null, '', pathname);
  return { page: 'reset', token };
}

export function watchRecoveryNavigation(
  browser: Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'>,
  onChange: (route: RecoveryRoute) => void,
): () => void {
  const change = () => onChange(readRecoveryLocation(browser));
  const hashChange = (event: HashChangeEvent) => {
    // popstate puede haber retirado ya el fragmento antes de hashchange.
    if (new URL(event.newURL).hash === browser.location.hash) change();
  };
  browser.addEventListener('popstate', change); browser.addEventListener('hashchange', hashChange);
  return () => { browser.removeEventListener('popstate', change); browser.removeEventListener('hashchange', hashChange); };
}

export function normalizeRecoveryEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function passwordRecoveryError(password: string, confirmation: string): string | null {
  const length = [...password].length;
  if (length < 12 || length > 128 || !password.trim().length) return 'La contraseña debe tener entre 12 y 128 caracteres y no puede contener solo espacios.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

export async function requestPasswordRecovery(value: string): Promise<string> {
  const email = normalizeRecoveryEmail(value);
  if (!email) throw new Error('Introduce un correo válido.');
  await jsonRequest('auth/forgot-password', 'POST', { email });
  // Mensaje local uniforme: nunca inferir si existe una cuenta del contenido.
  return recoveryMessage;
}

export async function submitPasswordReset(token: string, password: string, confirmation: string): Promise<void> {
  if (!validRecoveryToken(token)) throw new Error('El enlace de recuperación no es válido. Solicita uno nuevo.');
  const error = passwordRecoveryError(password, confirmation);
  if (error) throw new Error(error);
  await jsonRequest('auth/reset-password', 'POST', { token, password });
}
