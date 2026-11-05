import { useRef, useState } from 'react';
import type { User } from '../types/user';
import type { Page } from '../presentation';
import InterfaceIcon from './InterfaceIcon';
const landsisMarkUrl = new URL('../assets/branding/landsis-mark.png', import.meta.url).href;
export default function UserNavigation({ user, page, onPage, onLogout, busy }: {
  user: User; page: Page; onPage: (page: Page) => void; onLogout: () => void; busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => { setExpanded(false); toggleRef.current?.focus(); };
  const pages: [Page,string][] = [['dashboard','Dashboard'],['history','Historial'],['node','Estado del nodo']];
  if (user.role === 'ADMINISTRADOR') pages.push(['users','Usuarios']);
  return <>
    {expanded && <button className="sidebar-backdrop" aria-label="Cerrar menú lateral" onClick={closeMenu}/>}
    <aside className="sidebar side-navigation" data-expanded={expanded} aria-label="Menú lateral" onKeyDown={event => { if (event.key === 'Escape') closeMenu(); }}>
      <button ref={toggleRef} className="sidebar-toggle" aria-expanded={expanded} aria-controls="sidebar-links" aria-label={expanded ? 'Contraer menú' : 'Expandir menú'} title={expanded ? 'Contraer menú' : 'Expandir menú'} onClick={() => setExpanded(value => !value)}><span aria-hidden="true">{expanded ? '‹' : '☰'}</span><span className="nav-label">Contraer menú</span></button>
      <div className="sidebar-brand"><img className="brand-symbol" src={landsisMarkUrl} alt="LANDSIS" width={40} height={40}/><div className="nav-label"><strong>LANDSIS</strong><span>LADERA-1</span></div></div>
      <nav id="sidebar-links" className="nav-actions" aria-label="Sesión y navegación">{pages.map(([key,label]) => <button key={key} aria-label={label} title={label} aria-current={page === key ? 'page' : undefined} onClick={() => { onPage(key); closeMenu(); }}><span className="nav-initial" aria-hidden="true">{label.charAt(0)}</span><span className="nav-label"><InterfaceIcon name={key}/>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><button className="logout-button" aria-label={busy ? 'Cerrando…' : 'Cerrar sesión'} title="Cerrar sesión" onClick={onLogout} disabled={busy}><span className="nav-initial" aria-hidden="true">C</span><span className="nav-label"><InterfaceIcon name="logout"/>{busy ? 'Cerrando…' : 'Cerrar sesión'}</span></button></div>
    </aside>
    <header className="topbar"><div><h1>LANDSIS LADERA-1</h1><p>Sistema de Monitoreo Preventivo</p></div><div className="user-identity"><span className="user-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.role}</span></div></div></header>
  </>;
}