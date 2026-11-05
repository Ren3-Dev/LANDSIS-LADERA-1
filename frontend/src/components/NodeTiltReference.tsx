import type { Orientation } from '../types/orientation';
import { receptionState } from '../reception';

function NodeShape({ reference = false }: { reference?: boolean }) {
  return <g className={reference ? 'node-tilt-baseline' : 'node-tilt-shape'}>
    <path d="M110 110V66" fill="none" strokeWidth="7"/>
    <rect x="95" y="25" width="30" height="44" rx="5" strokeWidth="3"/>
    <path d="M102 38h16M102 46h16" fill="none" strokeWidth="2"/>
  </g>;
}

export default function NodeTiltReference({ orientation, receivedAt, now = Date.now() }: {
  orientation?: Orientation; receivedAt?: string; now?: number;
}) {
  const reception = receptionState(receivedAt,now);
  const ready = orientation?.status === 'ready' && reception === 'fresh'
    && Number.isFinite(orientation.deltaRoll) && Number.isFinite(orientation.deltaPitch) ? orientation : null;
  const scale = 1;
  const status = reception === 'stale' ? 'Sin datos recientes' : reception === 'invalid' ? 'Hora por verificar'
    : orientation?.status === 'calibrating' ? 'Calibrando referencia' : 'Sin orientación reciente';
  return <div className="node-tilt-reference">
    <div className="section-heading"><h3>Referencia visual del nodo</h3><span className="tag">Escala visual 1:1</span></div>
    <div className="node-tilt-views">{(['roll','pitch'] as const).map(axis=>{
      const value=ready ? (axis==='roll' ? ready.deltaRoll : ready.deltaPitch) : null;
      return <figure className="node-tilt-view" key={axis}>
        <svg viewBox="0 0 220 220" role="img" aria-label={value===null ? `Referencia de ${axis}: ${status}` : `Referencia de ${axis}: cambio real ${value.toFixed(2)} grados, escala visual por ${scale}`}>
          <circle cx="110" cy="110" r="92" fill="none" className="node-tilt-guide"/>
          <path d="M110 13v194M13 110h194" fill="none" className="node-tilt-guide"/>
          <NodeShape reference/>
          {value!==null && <g className="node-tilt-moving" style={{transform:`rotate(${value*scale}deg)`,transformOrigin:'110px 110px'}}><NodeShape/></g>}
          <circle cx="110" cy="110" r="5" className="node-tilt-pivot"/>
        </svg>
        <figcaption><strong>{axis==='roll' ? 'Roll' : 'Pitch'}</strong><span className="node-tilt-angle">{value===null ? status : `${value.toFixed(2)}°`}</span></figcaption>
      </figure>;
    })}</div>
    <p className="caption">Gris discontinuo: referencia de arranque. Azul: cambio relativo recibido. Escala visual 1:1. Vistas esquemáticas por eje; no representan desplazamiento del terreno.</p>
  </div>;
}
