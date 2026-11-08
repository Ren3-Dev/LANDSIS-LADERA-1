import { useEffect, useState, type FormEvent } from 'react';
import { getHistory, getDailyHistory, type LatestReading } from './api/telemetry';
import { startLatestPolling } from './api/pollLatest';
import { LATEST_REFRESH_MS, SCREEN_REFRESH_OPTIONS, receptionNow } from './reception';
import type { Reading } from './types/telemetry';
import { formatTimestamp, type TelemetryPage } from './presentation';
import { DashboardView, HistoryView, NodeStatusView } from './components/TelemetryViews';
type Status = 'loading' | 'ready' | 'error';
const nodeId = 'LADERA-1';
export default function App({ page = 'dashboard' }: { page?: TelemetryPage }) {
  const [dataStatus,setDataStatus] = useState<Status>('loading');
  const [refreshInterval,setRefreshInterval] = useState<number>(LATEST_REFRESH_MS);
  const [latestResponse,setLatestResponse] = useState<LatestReading | null>(null), [history,setHistory] = useState<Reading[]>([]);
  const [dailyHistory,setDailyHistory] = useState<Reading[]>([]);
  const [clockTick,setClockTick] = useState(() => performance.now()), [autoRefreshFailed,setAutoRefreshFailed] = useState(false);
  const latest = latestResponse?.reading ?? null;
  const now = latestResponse ? receptionNow(latestResponse.reading.receivedAt, latestResponse.serverTime, latestResponse.requestedAt, clockTick) : NaN;
  useEffect(() => {
    if (page === 'history') return;
    const tick = () => setClockTick(performance.now());
    tick();
    const interval = setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);
    window.addEventListener('focus',tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange',tick); window.removeEventListener('focus',tick); };
  },[page]);
  const [refresh,setRefresh] = useState(0), [queriedAt,setQueriedAt] = useState<string | null>(null);
  const [limit,setLimit] = useState('50'), [from,setFrom] = useState(''), [to,setTo] = useState(''), [filterError,setFilterError] = useState('');
  const [filters,setFilters] = useState<{limit:number;from?:string;to?:string}>({limit:50});
  useEffect(() => {
    setLatestResponse(null); setHistory([]); setDailyHistory([]); setQueriedAt(null); setDataStatus('loading'); setAutoRefreshFailed(false);
    if (page !== 'history') {
      let loaded = false;
      const polling = startLatestPolling(nodeId, {
        onData: response => {
          loaded = true;
          setLatestResponse(response);
          setClockTick(performance.now());
          setQueriedAt(response ? new Date(response.serverTime).toISOString() : new Date().toISOString());
          setDataStatus('ready');
          setAutoRefreshFailed(false);
        },
        onError: () => { if (loaded) setAutoRefreshFailed(true); else setDataStatus('error'); },
      }, undefined, refreshInterval);
      const resume = () => { if (refreshInterval > 0 && document.visibilityState === 'visible') void polling.refresh(); };
      document.addEventListener('visibilitychange',resume);
      window.addEventListener('focus',resume);
      return () => { polling.stop(); document.removeEventListener('visibilitychange',resume); window.removeEventListener('focus',resume); };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setDataStatus('error'); },15000);
    Promise.all([getHistory(nodeId,controller.signal,filters), getDailyHistory(nodeId,controller.signal,filters)]).then(([readings,daily]) => {
      if (!controller.signal.aborted) { setHistory(readings); setDailyHistory(daily); setQueriedAt(new Date().toISOString()); setDataStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setDataStatus('error'); }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  },[page,refresh,filters,refreshInterval]);
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const count = Number(limit);
    if (!Number.isInteger(count) || count < 1 || count > 100 || (from && to && new Date(from) >= new Date(to))) { setFilterError('Introduce un límite de 1 a 100 y una fecha final posterior a la inicial.'); return; }
    setFilterError(''); setFilters({limit:count,from:from ? new Date(from).toISOString() : undefined,to:to ? new Date(to).toISOString() : undefined});
  }
  const title = {dashboard:'Dashboard',history:'Historial',node:'Estado del nodo'}[page];
  return <main><div className="page-heading page-heading-with-actions">
      <div><h2>{title}</h2><p>{page === 'dashboard' ? 'Resumen de la última medición recibida.' : page === 'history' ? 'Una medición diaria y el historial detallado de LADERA-1 por intervalo.' : 'Disponibilidad técnica de datos, separada del riesgo.'}</p></div>
      <div className="refresh-controls">
        {page !== 'history' && <div className="refresh-choice"><label htmlFor="screen-refresh">Actualización de pantalla</label><select id="screen-refresh" value={refreshInterval} onChange={event => { const value=Number(event.target.value); if (SCREEN_REFRESH_OPTIONS.some(option => option.ms === value)) setRefreshInterval(value); }}>{SCREEN_REFRESH_OPTIONS.map(option => <option key={option.ms} value={option.ms}>{option.label}</option>)}</select></div>}
        <button disabled={dataStatus === 'loading'} onClick={() => setRefresh(v => v + 1)}>Actualizar ahora</button>
        <small className="refresh-meta">{queriedAt ? <>Última consulta: {formatTimestamp(queriedAt)}</> : 'Consultando LADERA-1'}{page !== 'history' && <> · Solo cambia la pantalla; el nodo sigue enviando cada 10 segundos.</>}</small>
        {page !== 'history' && (refreshInterval === 0 || refreshInterval > 60000) && <small className="refresh-meta">El semáforo queda gris si la lectura en pantalla cumple 60 segundos. Puedes usar Actualizar ahora.</small>}
      </div>
    </div>
    {page === 'history' && <form className="history-filters panel" onSubmit={applyFilters}><div><label htmlFor="limit">Límite por listado (1–100)</label><input id="limit" type="number" min="1" max="100" required value={limit} onChange={event => setLimit(event.target.value)}/></div><div><label htmlFor="from">Desde (incluido, hora local)</label><input id="from" type="datetime-local" step="1" value={from} onChange={event => setFrom(event.target.value)}/></div><div><label htmlFor="to">Hasta (excluido, hora local)</label><input id="to" type="datetime-local" step="1" value={to} onChange={event => setTo(event.target.value)}/></div><button disabled={dataStatus === 'loading'}>Consultar historial</button>{filterError && <p className="error notice" role="alert">{filterError}</p>}</form>}
    {autoRefreshFailed && page !== 'history' && <p className="notice" role="status">No se pudo actualizar automáticamente. Se conserva la última recepción disponible.</p>}
    <div aria-busy={dataStatus === 'loading'}>{dataStatus === 'loading' && <p className="notice" role="status">Cargando mediciones de {nodeId}…</p>}{dataStatus === 'error' && <p className="notice error" role="alert">No se pudieron cargar las mediciones. Verifica la conexión y pulsa Actualizar ahora.</p>}{dataStatus === 'ready' && (page === 'history' ? <HistoryView readings={history} dailyReadings={dailyHistory}/> : <>{!latest && <p className="notice" role="status">LADERA-1 todavía no tiene mediciones disponibles.</p>}{page === 'node' ? <NodeStatusView reading={latest} now={now}/> : <DashboardView reading={latest} nodeId={nodeId} now={now} queriedAt={queriedAt}/>}</>)}</div>
    {page === 'history' && <p className="caption">El límite aplica a días en el resumen diario y a lecturas en el historial detallado. Ambos listados corresponden a LADERA-1 y al intervalo consultado.</p>}
    <footer>LANDSIS LADERA-1 · Beta académica<span>Orientación experimental del nodo · riesgo global pendiente.</span></footer></main>;
}

