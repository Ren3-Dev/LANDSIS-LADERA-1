import { useCallback, useEffect, useState } from 'react';
import Dashboard from './App';
import LoginForm from './components/LoginForm';
import UserNavigation from './components/UserNavigation';
import UsersPanel from './components/UsersPanel';
import { ApiError, jsonRequest } from './api/http';
import type { Page } from './presentation';
import type { User } from './types/user';

export default function AuthApp() {
  const [user, setUser] = useState<User | null>(null), [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [page, setPage] = useState<Page>('dashboard'), [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0), [busy, setBusy] = useState(false);
  const expire = useCallback(() => { setUser(null); setPage('dashboard'); setNotice('La sesión terminó. Inicia sesión de nuevo.'); setStatus('ready'); }, []);
  useEffect(() => {
    let active = true; setStatus('loading');
    jsonRequest<{ user: User }>('auth/me').then(data => { if (active) { setUser(data.user); setStatus('ready'); } })
      .catch(error => { if (active) { setUser(null); setStatus(error instanceof ApiError && error.status === 401 ? 'ready' : 'error'); } });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    window.addEventListener('landsis-session-expired', expire);
    return () => window.removeEventListener('landsis-session-expired', expire);
  }, [expire]);
  // Actualizar rol/estado al volver a la pestaña, sin consultar en cada render.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = () => { jsonRequest<{ user: User }>('auth/me').then(data => { if (active) setUser(data.user); }).catch(error => { if (active && error instanceof ApiError && error.status === 401) expire(); }); };
    window.addEventListener('focus', check); return () => { active = false; window.removeEventListener('focus', check); };
  }, [user?.id, expire]);
  async function logout() {
    setBusy(true); setNotice('');
    try { await jsonRequest('auth/logout', 'POST', {}); setUser(null); setPage('dashboard'); setNotice('Sesión cerrada.'); }
    catch { setNotice('No se pudo cerrar la sesión en el servidor. Intenta de nuevo.'); }
    finally { setBusy(false); }
  }
  if (status === 'loading') return <main><p className="notice" role="status">Verificando sesión…</p></main>;
  if (status === 'error') return <main><p className="notice error" role="alert">No se pudo verificar la sesión. Comprueba el backend.</p><button onClick={() => setRetry(v => v + 1)}>Reintentar</button></main>;
  if (!user) return <LoginForm notice={notice} onLogin={u => { setUser(u); setNotice(''); setPage('dashboard'); }}/>;
  return <div className="app-shell"><UserNavigation user={user} page={page} busy={busy} onPage={setPage} onLogout={logout}/><div className="app-content">{notice && <div className="session-message notice error" role="alert">{notice}</div>}{page === 'users' && user.role === 'ADMINISTRADOR' ? <UsersPanel onUserChange={u => { if (u.id === user.id) { if (!u.active) expire(); else { setUser(u); if (u.role !== 'ADMINISTRADOR') setPage('dashboard'); } } }}/> : <Dashboard page={page === 'users' ? 'dashboard' : page}/>}</div></div>;
}


