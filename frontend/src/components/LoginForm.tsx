import { useState, type FormEvent } from 'react';
import { ApiError, jsonRequest } from '../api/http';
import type { User } from '../types/user';
import { RecoveryLink } from './RecoveryViews';

export default function LoginForm({ onLogin, notice = '', onForgotPassword }: { onLogin: (user: User) => void; notice?: string; onForgotPassword?: () => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const data = await jsonRequest<{ user: User }>('auth/login', 'POST', { email, password }); setPassword(''); onLogin(data.user); }
    catch (error) { setError(error instanceof ApiError ? error.message : 'No se pudo conectar con el backend. Intenta de nuevo.'); setPassword(''); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="panel login-panel"><p className="eyebrow">SISTEMA DE MONITOREO PREVENTIVO</p><h1>LANDSIS LADERA-1</h1><p className="subtitle">Inicia sesión para consultar la telemetría.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <form onSubmit={submit} aria-busy={busy}><label htmlFor="email">Correo</label><input id="email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)}/><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)}/>
      {error && <p className="notice error" role="alert">{error}</p>}<button disabled={busy} type="submit">{busy ? 'Iniciando sesión…' : 'Iniciar sesión'}</button>
    </form><p className="caption"><RecoveryLink page="forgot" onNavigate={() => { if (onForgotPassword) onForgotPassword(); else window.location.assign('/forgot-password'); }}>¿Olvidaste tu contraseña?</RecoveryLink></p>
    <p className="caption">Acceso para Administrador, Investigador y CONRED.</p></section></main>;
}
