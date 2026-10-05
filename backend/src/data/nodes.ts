import { getPool } from './postgres.js';

export interface NodeIdentity { nodeId: string }
export type ListNodes = () => Promise<NodeIdentity[]>;

export const listNodes: ListNodes = async () => {
  const result = await getPool().query<{ node_id: string }>(
    'SELECT node_id FROM nodes ORDER BY node_id COLLATE "C"',
  );
  return result.rows.map((row) => ({ nodeId: row.node_id }));
};
