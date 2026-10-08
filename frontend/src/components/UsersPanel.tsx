import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, jsonRequest } from '../api/http';
import { roles, type Role, type User } from '../types/user';

type Draft = { name: string; email: string; password: string; confirmation: string; role: Role; active: boolean };
const blank: Draft = { name: '', email: '', password: '', confirmation: '', role: 'INVESTIGADOR', active: true };
export default function UsersPanel({ onUserChange }: { onUserChange: (user: User) => void }) {
  const [users, setUsers] = useState<User[]>([]), [status, setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [reload, setReload] = useState(0), [editing, setEditing] = useState<User | null>(null), [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true; setStatus('loading');
    jsonRequest<{ users: User[] }>('users').then(data => { if (active) { setUsers(data.users); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [reload]);
  function open(user: User | null) {
    setEditing(user); setDraft(user ? { ...blank, name: user.name, email: user.email, role: user.role, active: user.active } : { ...blank });
    setError(''); setSuccess(''); setShowForm(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!editing && draft.password !== draft.confirmation) { setError('Las contraseñas no coinciden.'); return; }
    if (!editing && ([...draft.password].length < 12 || [...draft.password].length > 128 || !draft.password.trim())) { setError('La contraseña debe tener entre 12 y 128 caracteres.'); return; }
    setBusy(true);
    try {
      const body = editing ? { name: draft.name, role: draft.role, active: draft.active } : { name: draft.name, email: draft.email, password: draft.password, role: draft.role, active: draft.active };
      const data = await jsonRequest<{ user: User }>(editing ? `users/${editing.id}` : 'users', editing ? 'PATCH' : 'POST', body);
      setDraft({ ...blank }); setShowForm(false); setSuccess(editing ? 'Usuario actualizado.' : 'Usuario creado.'); setReload(v => v + 1); onUserChange(data.user);
    } catch (error) { setError(error instanceof ApiError ? error.message : 'No se pudo conectar con el backend.'); setDraft(v => ({ ...v, password: '', confirmation: '' })); }
    finally { setBusy(false); }
  }
  return <main><div className="section-heading"><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Usuarios</h1><p className="subtitle">Nombre, rol y estado de las cuentas del sistema.</p></div><button onClick={() => open(null)} disabled={busy}>+ Nuevo usuario</button></div>
    {success && <p className="notice" role="status">{success}</p>}
    {status === 'loading' && <p className="notice" role="status">Cargando usuarios…</p>}
    {status === 'error' && <div className="notice error" role="alert">No se pudieron consultar los usuarios. Verifica tu sesión y permiso de administrador. <button onClick={() => setReload(v => v + 1)}>Reintentar</button></div>}
    {showForm && <section className="panel"><h2>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2><form onSubmit={submit} className="user-form" aria-busy={busy}><fieldset disabled={busy}>
      <div className="form-grid"><div><label htmlFor="user-name">Nombre</label><input id="user-name" required maxLength={100} value={draft.name} onChange={e => setDraft(v => ({ ...v, name: e.target.value }))}/></div>
      <div><label htmlFor="user-email">Correo</label><input id="user-email" type="email" autoComplete="off" required disabled={!!editing} maxLength={254} value={draft.email} onChange={e => setDraft(v => ({ ...v, email: e.target.value }))}/></div>
      <div><label htmlFor="user-role">Rol</label><select id="user-role" value={draft.role} onChange={e => setDraft(v => ({ ...v, role: e.target.value as Role }))}>{roles.map(role => <option key={role}>{role}</option>)}</select></div>
      {!editing && <><div><label htmlFor="user-password">Contraseña</label><input id="user-password" type="password" autoComplete="new-password" required maxLength={256} value={draft.password} onChange={e => setDraft(v => ({ ...v, password: e.target.value }))}/><p className="caption">12 a 128 caracteres, sin reglas de composición.</p></div><div><label htmlFor="user-confirmation">Confirmar contraseña</label><input id="user-confirmation" type="password" autoComplete="new-password" required maxLength={256} value={draft.confirmation} onChange={e => setDraft(v => ({ ...v, confirmation: e.target.value }))}/></div></>}
      <div className="checkbox-field"><label><input type="checkbox" checked={draft.active} onChange={e => setDraft(v => ({ ...v, active: e.target.checked }))}/> Usuario activo</label></div></div>
      {error && <p className="notice error" role="alert">{error}</p>}<div className="nav-actions"><button type="submit">{busy ? 'Guardando…' : 'Guardar usuario'}</button><button type="button" className="secondary" onClick={() => { setShowForm(false); setDraft({ ...blank }); }}>Cancelar</button></div>
    </fieldset></form></section>}
    {status === 'ready' && <section className="panel">{users.length ? <div className="table-scroll"><table><thead><tr>{['Nombre', 'Correo', 'Rol', 'Estado', 'Acción'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active ? 'Activo' : 'Inactivo'}</td><td><button className="secondary" disabled={busy} onClick={() => open(user)}>Editar</button></td></tr>)}</tbody></table></div> : <p className="empty">No hay usuarios disponibles.</p>}</section>}
  </main>;
}

