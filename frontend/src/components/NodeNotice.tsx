import { useEffect, useState } from 'react';
import type { Reading } from '../types/telemetry';
import { emptyNodeNotice, loadNodeNotice, updateNodeNotice } from '../nodeNotice';
export default function NodeNotice({reading,now,queriedAt}:{reading:Reading|null;now:number;queriedAt:string|null}) {
  const [state,setState] = useState(()=>{try{return loadNodeNotice(window.localStorage);}catch{return {...emptyNodeNotice};}});
  const [imageFailed,setImageFailed] = useState(false);
  useEffect(()=>{
    setState(previous=>{
      const next=updateNodeNotice(previous,reading,queriedAt ? Date.parse(queriedAt) : NaN,now);
      try { window.localStorage.setItem('landsis-node-notice-v1',JSON.stringify(next)); } catch { /* Mantener aviso en memoria. */ }
      return next;
    });
  },[reading,now,queriedAt]);
  if(state.activatedAt === null) return null;
  const recovered=state.recoveredAt !== null;
  return <><a className="node-notice-jump" href="#node-special-notice">↓ Ver aviso del nodo</a>
    <section id="node-special-notice" className="panel node-special-notice" aria-labelledby="node-notice-heading" role="status">
      <h2 id="node-notice-heading">{recovered ? 'Comunicación restablecida' : 'Sayonara, mundo… fue un placer 👋'}</h2>
      {!imageFailed && <img src="/images/despedida-nodo.jpg" alt="Imagen de despedida del nodo LADERA-1" onError={()=>setImageFailed(true)}/>}
      <p>{recovered ? 'El nodo volvió a transmitir después del aviso. Este mensaje se conserva hasta completar una hora desde su activación.' : 'Se perdió comunicación después de una inclinación en ALERTA o CRÍTICO confirmada. Es posible que el nodo haya sufrido daños considerables; favor revisarlo.'}</p>
      <p className="caption">La falta de datos también puede deberse a alimentación o red. No confirma daños ni sepultamiento.</p>
      <p><strong>Creado por:</strong> Kevin Escobar Cifuentes<br/><strong>Contacto:</strong> <a href="mailto:kevinaugustorenela@gmail.com">kevinaugustorenela@gmail.com</a></p>
    </section></>;
}
