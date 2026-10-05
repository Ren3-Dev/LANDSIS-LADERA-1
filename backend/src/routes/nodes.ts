import { Router } from 'express';
import type { ListNodes } from '../data/nodes.js';

export function createNodesRouter(loadNodes: ListNodes) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      res.status(200).json({ nodes: await loadNodes() });
    } catch {
      res.status(500).json({ status: 'error', message: 'No se pudieron consultar los nodos.' });
    }
  });
  return router;
}
