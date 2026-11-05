export interface RecoveryConfig { emailEnabled: boolean; frontendUrl?: string }

export function loadRecoveryConfig(env: NodeJS.ProcessEnv = process.env): RecoveryConfig {
  const flag = env.RECOVERY_EMAIL_ENABLED ?? 'false';
  if (flag !== 'true' && flag !== 'false') throw new Error('RECOVERY_EMAIL_ENABLED debe ser true o false.');
  if (flag === 'false') return { emailEnabled: false };
  const invalid = () => new Error('FRONTEND_URL inválida para recuperación.');
  let url: URL;
  try { url = new URL(env.FRONTEND_URL ?? ''); } catch { throw invalid(); }
  const localHttp = env.NODE_ENV !== 'production' && url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.search || url.hash) throw invalid();
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return { emailEnabled: true, frontendUrl: url.href };
}
