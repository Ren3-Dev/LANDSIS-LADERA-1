import type { UserStore } from '../data/users.js';
import type { MailService } from '../mail/service.js';
import { validMailbox } from '../config/mail.js';
import { inclinationAlertTemplate } from '../mail/inclination-template.js';
import type { AlertReading, AlertSignal, AlertStateStore, DeliveryCounts } from './types.js';

export function alertSignal(reading: AlertReading): AlertSignal {
  const o = reading.orientation;
  if (o?.status !== 'ready') return 'other';
  const delta = Math.max(Math.abs(o.deltaRoll), Math.abs(o.deltaPitch));
  if (o.inclinationState === 'CRITICO' && o.criticalCount === 6 && delta >= 2) return 'critical';
  if (o.inclinationState === 'NORMAL' && delta < 0.5 && o.precautionCount === 0 && o.alertCount === 0 && o.criticalCount === 0) return 'normal';
  return 'other';
}

export function createInclinationNotifier(options: {
  store: AlertStateStore; users: Pick<UserStore,'list'>; mail: Pick<MailService,'send'>;
  onError: () => void; onResult?: (counts: DeliveryCounts) => void;
}) {
  let chain = Promise.resolve();
  let queued = 0;
  const reportError = () => { try { options.onError(); } catch { /* No interrumpir recepción. */ } };
  async function process(reading: AlertReading) {
    if (!await options.store.claim(reading, alertSignal(reading))) return;
    try {
      const users = await options.users.list(); // Solo usuarios no eliminados según el store existente.
      const recipients = new Set<string>();
      const counts: DeliveryCounts = {accepted:0,failed:0,skipped:0};
      for (const user of users) {
        if (!user.active) continue;
        const email = user.email.trim().toLowerCase();
        if (!validMailbox(email)) { counts.skipped++; continue; }
        recipients.add(email);
      }
      const content = inclinationAlertTemplate(reading);
      for (const to of recipients) {
        try { await options.mail.send({to,...content}); counts.accepted++; }
        catch { counts.failed++; reportError(); } // Continuar con los demás destinatarios.
      }
      await options.store.finish(reading.nodeId,reading.id,counts);
      try { options.onResult?.(counts); } catch { /* El informe no modifica la entrega. */ }
    } catch {
      await options.store.fail(reading.nodeId,reading.id).catch(()=>{});
      reportError();
    }
  }
  return {
    observe(reading: AlertReading) {
      if (reading.nodeId !== 'LADERA-1') return;
      if (queued >= 32) { reportError(); return; }
      queued++;
      chain = chain.then(()=>process(reading)).catch(reportError).finally(()=>{queued--;});
    },
    idle: () => chain,
  };
}
