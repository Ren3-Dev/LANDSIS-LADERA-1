import { useEffect, useState, type FormEvent } from 'react';
import { getNodes, getLatest, getHistory } from './api/telemetry';
import type { Node, Reading } from './types/telemetry';
import { formatTimestamp, type TelemetryPage } from './presentation';
import { DashboardView, HistoryView, NodeStatusView } from './components/TelemetryViews';
type Status = 'loading' | 'ready' | 'error';
export default function App({ page = 'dashboard' }: { page?: TelemetryPage }) {
  const [nodes,setNodes] = useState<Node[]>([]), [nodeId,setNodeId] = useState('');
  const [nodesStatus,setNodesStatus] = useState<Status>('loading'), [dataStatus,setDataStatus] = useState<Status>('loading');
  const [latest,setLatest] = useState<Reading | null>(null), [history,setHistory] = useState<Reading[]>([]);
  const [retry,setRetry] = useState(0), [refresh,setRefresh] = useState(0), [queriedAt,setQueriedAt] = useState<string | null>(null);
  const [limit,setLimit] = useState('50'), [from,setFrom] = useState(''), [to,setTo] = useState(''), [filterError,setFilterError] = useState('');
  const [filters,setFilters] = useState<{limit:number;from?:string;to?:string}>({limit:50});
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setNodesStatus('error'); },15000);
    setNodesStatus('loading');
    getNodes(controller.signal).then(items => { if (!controller.signal.aborted) { setNodes(items); setNodeId(current => items.some(n => n.nodeId === current) ? current : items[0]?.nodeId ?? ''); setNodesStatus('ready'); } }).catch(() => { if (!controller.signal.aborted) setNodesStatus('error'); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  },[retry]);
  useEffect(() => {
    if (!nodeId || nodesStatus !== 'ready') return;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setDataStatus('error'); },15000);
    setLatest(null); setHistory([]); setQueriedAt(null); setDataStatus('loading');
    const request = page === 'history' ? getHistory(nodeId,controller.signal,filters).then(readings => { if (!controller.signal.aborted) setHistory(readings); }) : getLatest(nodeId,controller.signal).then(reading => { if (!controller.signal.aborted) setLatest(reading); });
    request.then(() => { if (!controller.signal.aborted) { setQueriedAt(new Date().toISOString()); setDataStatus('ready'); } }).catch(() => { if (!controller.signal.aborted) setDataStatus('error'); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  },[nodeId,nodesStatus,page,refresh,filters]);
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const count = Number(limit);
    if (!Number.isInteger(count) || count < 1 || count > 100 || (from && to && new Date(from) >= new Date(to))) { setFilterError('Introduce un límite de 1 a 100 y una fecha final posterior a la inicial.'); return; }
    setFilterError(''); setFilters({limit:count,from:from ? new Date(from).toISOString() : undefined,to:to ? new Date(to).toISOString() : undefined});
  }
  const title = {dashboard:'Dashboard',history:'Historial',node:'Estado del nodo'}[page];
  return <main><div className="page-heading"><h2>{title}</h2><p>{page === 'dashboard' ? 'Resumen de la última medición recibida.' : page === 'history' ? 'Consulta las mediciones originales por nodo e intervalo.' : 'Disponibilidad técnica de datos, separada del riesgo.'}</p></div>
    <section className="toolbar" aria-label="Selección y consulta"><div><label htmlFor="node">Nodo seleccionado</label><select id="node" value={nodeId} disabled={nodesStatus !== 'ready' || !nodes.length} onChange={event => { setDataStatus('loading'); setNodeId(event.target.value); }}>{!nodes.length && <option value="">{nodesStatus === 'loading' ? 'Cargando nodos…' : 'Sin nodos disponibles'}</option>}{nodes.map(node => <option key={node.nodeId}>{node.nodeId}</option>)}</select></div><div className="query-info">{queriedAt ? <>Consulta realizada<br/><strong>{formatTimestamp(queriedAt)}</strong></> : 'Consulta de datos del backend'}</div><button disabled={nodesStatus === 'loading' || (!!nodeId && nodesStatus === 'ready' && dataStatus === 'loading')} onClick={() => nodesStatus === 'error' || !nodes.length ? setRetry(v => v + 1) : setRefresh(v => v + 1)}>Actualizar datos</button></section>
    {page === 'history' && <form className="history-filters panel" onSubmit={applyFilters}><div><label htmlFor="limit">Límite (1–100)</label><input id="limit" type="number" min="1" max="100" required value={limit} onChange={event => setLimit(event.target.value)}/></div><div><label htmlFor="from">Desde (incluido, hora local)</label><input id="from" type="datetime-local" step="1" value={from} onChange={event => setFrom(event.target.value)}/></div><div><label htmlFor="to">Hasta (excluido, hora local)</label><input id="to" type="datetime-local" step="1" value={to} onChange={event => setTo(event.target.value)}/></div><button disabled={!nodeId || nodesStatus !== 'ready'}>Consultar historial</button>{filterError && <p className="error notice" role="alert">{filterError}</p>}</form>}
    {nodesStatus === 'loading' && <p className="notice" role="status">Cargando catálogo de nodos…</p>}{nodesStatus === 'error' && <p className="notice error" role="alert">No se pudo consultar el catálogo. Verifica el backend y pulsa Actualizar datos.</p>}{nodesStatus === 'ready' && !nodes.length && <p className="notice" role="status">No hay nodos registrados en el backend.</p>}
    {nodesStatus === 'ready' && nodeId && <div aria-busy={dataStatus === 'loading'}>{dataStatus === 'loading' && <p className="notice" role="status">Cargando mediciones de {nodeId}…</p>}{dataStatus === 'error' && <p className="notice error" role="alert">No se pudieron cargar las mediciones. Verifica la conexión y pulsa Actualizar datos.</p>}{dataStatus === 'ready' && (page === 'history' ? <HistoryView readings={history}/> : <>{!latest && <p className="notice" role="status">Este nodo todavía no tiene mediciones disponibles.</p>}{page === 'node' ? <NodeStatusView reading={latest}/> : <DashboardView reading={latest} nodeId={nodeId}/>}</>)}</div>}
    <footer>LANDSIS LADERA-1 · Beta académica<span>Sin evaluación de riesgo ni cálculo de inclinación.</span></footer></main>;
}

