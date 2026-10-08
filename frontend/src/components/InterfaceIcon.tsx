import type { Page } from '../presentation';
type IconName = Page | 'moisture' | 'vibration' | 'communication' | 'risk' | 'logout';
// Formas SVG simples de presentación; sin librería ni recursos externos.
export default function InterfaceIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    history: 'M4 4v16h16 M7 15l4-5 4 3 5-7',
    node: 'M8 8h8v8H8z M9 3v5 M15 3v5 M9 16v5 M15 16v5 M3 9h5 M3 15h5 M16 9h5 M16 15h5',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
    moisture: 'M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12z M8 15a4 4 0 0 0 4 4',
    vibration: 'M2 12h4l2-6 4 12 4-12 2 6h4',
    communication: 'M12 8v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    risk: 'M12 3l9 5v5c0 4-5 7-9 9-4-2-9-5-9-9V8z M12 8v5 M12 17h.01',
    logout: 'M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4',
  };
  return <svg className="interface-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
