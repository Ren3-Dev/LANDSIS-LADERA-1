export const roles = ['ADMINISTRADOR', 'INVESTIGADOR', 'CONRED'] as const;
export type Role = typeof roles[number];
export interface User { id: number; name: string; email: string; role: Role; active: boolean; createdAt: string }
