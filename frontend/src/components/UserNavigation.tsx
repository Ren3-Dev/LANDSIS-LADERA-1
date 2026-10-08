import type { User } from '../types/user';
import type { Page } from '../presentation';
import InterfaceIcon from './InterfaceIcon';
const landsisMarkUrl = new URL('../assets/branding/landsis-mark.png', import.meta.url).href;
export default function UserNavigation({ user, page, onPage, onLogout, busy }: {
  user: User; page: Page; onPage: (page: Page) => void; onLogout: () => void; busy: boolean;
}) {
  const pages: [Page,string][] = [['dashboard','Dashboard'],['history','Historial'],['node','Estado del nodo']];
  if (user.role === 'ADMINISTRADOR') pages.push(['users','Usuarios']);
  return <><aside className="sidebar"><div className="sidebar-brand"><img className="brand-symbol" src={landsisMarkUrl} alt="" width={40} height={40} /><div><strong>LANDSIS</strong><span>LADERA-1</span></div></div><p className="sidebar-label">MONITOREO DEL TERRENO</p><nav className="nav-actions" aria-label="Sesión y navegación">{pages.map(([key,label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => onPage(key)}><InterfaceIcon name={key}/>{label}</button>)}</nav><div className="sidebar-bottom"><p>Beta académica<span>Telemetría experimental</span></p><button className="logout-button" onClick={onLogout} disabled={busy}><InterfaceIcon name="logout"/>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button></div></aside><header className="topbar"><div><h1>LANDSIS LADERA-1</h1><p>Sistema de Monitoreo Preventivo</p></div><div className="user-identity"><span className="user-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.role}</span></div></div></header></>;
}
