import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// Un único nodo configurado; el secreto debe ser 32 bytes aleatorios en hexadecimal.
export function deviceConfig(env: NodeJS.ProcessEnv = process.env) {
  const token = env.IOT_DEVICE_TOKEN ?? '';
  const nodeId = env.IOT_NODE_ID ?? '';
  if (!/^[a-f0-9]{64}$/.test(token) || !nodeId.trim() || nodeId !== nodeId.trim()) return null;
  return { token, nodeId };
}

export function createDeviceAuth(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const config = deviceConfig(env);
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = config ? digest(config.token) : undefined;
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!config || !expected) {
      res.status(503).json({ message: 'Recepción IoT no configurada.' }); return;
    }
    // rawHeaders permite rechazar duplicados incluso si el servidor los combina.
    const count = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i]!.toLowerCase() === 'x-landsis-device-token').length;
    const token = req.get('X-Landsis-Device-Token') ?? '';
    const matches = timingSafeEqual(digest(token), expected);
    if (count !== 1 || !/^[a-f0-9]{64}$/.test(token) || !matches) {
      res.status(401).json({ message: 'Credenciales de dispositivo inválidas.' }); return;
    }
    res.locals.deviceNodeId = config.nodeId;
    next();
  };
}
