import 'dotenv/config';
import { createApp } from './app.js';
import { createSecurity } from './auth/security.js';
import { loadRecoveryConfig } from './config/recovery.js';
import { createSmtpMailService } from './mail/service.js';
import { alertEmailEnabled } from './config/alerts.js';
import { createInclinationNotifier } from './alerts/notifier.js';
import { alertStateStore } from './alerts/store.js';
import { userStore } from './data/users.js';
import { getPool } from './data/postgres.js';
import type { CommittedReadingObserver } from './alerts/types.js';

const port = Number(process.env.PORT ?? 3000);
// Opcional por proceso: permite aislar pruebas sin cambiar el despliegue habitual.
const host = process.env.LANDSIS_HOST?.trim();

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número entero entre 1 y 65535.');
}

const recovery = loadRecoveryConfig();
const security = createSecurity(undefined, undefined, recovery.emailEnabled ? {
  mail: createSmtpMailService(), frontendUrl: recovery.frontendUrl!,
  onFailure: () => console.error('No se completó una solicitud de correo de recuperación.'),
} : {});
async function start() {
  let observe: CommittedReadingObserver | undefined;
  try {
    if (alertEmailEnabled()) {
      await getPool().query('SELECT node_id, critical_active FROM inclination_email_state LIMIT 0');
      observe = createInclinationNotifier({store:alertStateStore, users:userStore, mail:createSmtpMailService(),
        onError:()=>console.error('Aviso de inclinación no completado; revisar estado de entrega.'),
        onResult:c=>console.log(`Aviso de inclinación: aceptados SMTP=${c.accepted}, fallidos=${c.failed}, omitidos=${c.skipped}`),
      }).observe;
      console.log('Correo automático de inclinación habilitado: CRÍTICO confirmado 6/6.');
    }
  } catch { console.error('Correo automático de inclinación deshabilitado por configuración o tabla pendiente. La recepción continúa.'); }
  createApp(undefined, undefined, undefined, security, undefined, observe).listen({ port, ...(host ? { host } : {}) }, () => {
  console.log(`LANDSIS LADERA-1 API escuchando en el puerto ${port}`);
  });
}
void start();

