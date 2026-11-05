import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { ApiError } from '../api/http';
import { normalizeRecoveryEmail, passwordRecoveryError, recoveryPaths, requestPasswordRecovery,
  submitPasswordReset, validRecoveryToken, type RecoveryPage } from '../recovery';

type Navigate = (page: RecoveryPage) => void;

export function RecoveryLink({ page, onNavigate, children }: { page: RecoveryPage; onNavigate: Navigate; children: ReactNode }) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(page);
  }
  return <a href={recoveryPaths[page]} onClick={follow}>{children}</a>;
}

function RecoveryPanel({ title, children }: { title: string; children: ReactNode }) {
  return <main className="login-page"><section className="panel login-panel recovery-panel" aria-labelledby="recovery-title">
    <p className="eyebrow">SISTEMA DE MONITOREO PREVENTIVO</p><h1>LANDSIS LADERA-1</h1>
    <h2 id="recovery-title">{title}</h2>{children}
  </section></main>;
}

export function ForgotPasswordView({ onNavigate }: { onNavigate: Navigate }) {
  const [email, setEmail] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError('');
    if (!normalizeRecoveryEmail(email)) { setError('Introduce un correo válido.'); return; }
    setBusy(true);
    try { setMessage(await requestPasswordRecovery(email)); setEmail(''); }
    catch (error) { setError(error instanceof ApiError ? error.message : 'No se pudo solicitar la recuperación. Comprueba la conexión e intenta de nuevo.'); }
    finally { setBusy(false); }
  }
  return <RecoveryPanel title="Recuperar contraseña">
    {message ? <p className="notice" role="status">{message}</p> : <>
      <p className="subtitle">Ingresa el correo asociado a tu cuenta para solicitar un enlace de recuperación.</p>
      <form onSubmit={submit} aria-busy={busy} noValidate>
        <label htmlFor="recovery-email">Correo</label><input id="recovery-email" type="email" autoComplete="email" maxLength={254} required
          disabled={busy} value={email} onChange={event => setEmail(event.target.value)}/>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button disabled={busy} type="submit">{busy ? 'Solicitando enlace…' : 'Enviar enlace de recuperación'}</button>
      </form></>}
    <p className="caption recovery-links"><RecoveryLink page="login" onNavigate={onNavigate}>Volver al inicio de sesión</RecoveryLink></p>
  </RecoveryPanel>;
}

export function ResetPasswordView({ token, onComplete, onNavigate }: { token: string | null; onComplete: () => void; onNavigate: Navigate }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [invalidLink, setInvalidLink] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const validLink = validRecoveryToken(token) && !invalidLink;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !validRecoveryToken(token) || invalidLink) return;
    setError('');
    const issue = passwordRecoveryError(password, confirmation);
    if (issue) { setError(issue); return; }
    setBusy(true);
    try { await submitPasswordReset(token, password, confirmation); if (mounted.current) onComplete(); }
    catch (error) {
      if (error instanceof ApiError && error.status === 400) setInvalidLink(true);
      setError(error instanceof ApiError ? error.message : 'No se pudo restablecer la contraseña. Comprueba la conexión e intenta de nuevo.');
    } finally { setPassword(''); setConfirmation(''); setBusy(false); }
  }
  return <RecoveryPanel title="Establecer nueva contraseña">
    {!validLink ? <><p className="notice error" role="alert">{error || 'El enlace de recuperación está incompleto o no es válido. Solicita uno nuevo.'}</p>
      <p className="caption"><RecoveryLink page="forgot" onNavigate={onNavigate}>Solicitar un nuevo enlace</RecoveryLink></p></> : <>
      <p className="subtitle" id="password-policy">Usa entre 12 y 128 caracteres. La contraseña no puede contener solo espacios.</p>
      <form onSubmit={submit} aria-busy={busy} noValidate>
        <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" required
          aria-describedby="password-policy" maxLength={256} disabled={busy} value={password} onChange={event => setPassword(event.target.value)}/>
        <label htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" required
          maxLength={256} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)}/>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button disabled={busy} type="submit">{busy ? 'Restableciendo…' : 'Restablecer contraseña'}</button>
      </form></>}
    <p className="caption recovery-links"><RecoveryLink page="login" onNavigate={onNavigate}>Volver al inicio de sesión</RecoveryLink></p>
  </RecoveryPanel>;
}

export function PasswordResetComplete({ onNavigate }: { onNavigate: Navigate }) {
  return <RecoveryPanel title="Contraseña restablecida"><p className="notice" role="status">Tu contraseña se restableció correctamente. Inicia sesión con tu nueva contraseña.</p>
    <p className="caption recovery-links"><RecoveryLink page="login" onNavigate={onNavigate}>Volver al inicio de sesión</RecoveryLink></p>
  </RecoveryPanel>;
}
