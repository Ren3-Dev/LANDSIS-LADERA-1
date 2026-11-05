export function alertEmailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ALERT_EMAIL_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') throw new Error('ALERT_EMAIL_ENABLED debe ser true o false.');
  return value === 'true';
}
