import type { MailContent } from './templates.js';
import type { AlertReading } from '../alerts/types.js';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);

export function inclinationAlertTemplate(reading: AlertReading): MailContent {
  const o = reading.orientation;
  if (o?.status !== 'ready') throw new Error('Orientación no disponible para el aviso.');
  const timestamp = new Date(reading.receivedAt).toLocaleString('es-GT', {timeZone:'America/Guatemala'});
  const rows = [
    ['📍 Nodo',reading.nodeId], ['🕒 Recepción (Guatemala)',timestamp],
    ['⚠️ Nivel','CRÍTICO de inclinación confirmado'],
    ['💧 Humedad del suelo',`${reading.soilMoistureRaw} RAW ADC — pendiente de calibración; no es porcentaje`],
    ['📐 Delta roll',`${o.deltaRoll.toFixed(2)}°`], ['📐 Delta pitch',`${o.deltaPitch.toFixed(2)}°`],
    ['⏱️ Persistencia',`${o.criticalCount}/6 evaluaciones consecutivas; cadencia aproximada de 10 segundos`],
    ['📳 Vibración',reading.vibrationDetected ? 'Detectada en la ventana de envío' : 'No detectada en esta medición'],
    ['Referencia roll / pitch',`${o.baselineRoll.toFixed(2)}° / ${o.baselinePitch.toFixed(2)}°`],
    ['Medición',String(reading.id)],
  ];
  const intro = 'Se confirmó una inclinación relativa crítica respecto a la referencia de arranque del nodo.';
  const notice = 'Revisa las mediciones del sistema. Este aviso experimental no declara un deslizamiento ni sustituye una evaluación geotécnica. No se afirma un aumento de humedad o vibración que los datos no permitan comprobar.';
  return {
    subject:'[LANDSIS] 🚨 Inclinación CRÍTICA confirmada — LADERA-1',
    text:`🚨 AVISO AUTOMÁTICO DE INCLINACIÓN\n\n${intro}\n\n${rows.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\n${notice}`,
    html:`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="max-width:640px;margin:auto;font-family:Arial,sans-serif;line-height:1.6"><h1>🚨 LANDSIS LADERA-1</h1><h2>Inclinación CRÍTICA confirmada</h2><p>${escape(intro)}</p><table style="width:100%;border-collapse:collapse">${rows.map(([k,v])=>`<tr><th scope="row" style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${escape(k!)}</th><td style="padding:8px;border-bottom:1px solid #ddd">${escape(v!)}</td></tr>`).join('')}</table><p>${escape(notice)}</p></main></body></html>`,
  };
}
