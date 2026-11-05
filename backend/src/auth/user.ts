import { validPassword } from './password.js';
export const roles = ['ADMINISTRADOR', 'INVESTIGADOR', 'CONRED'] as const;
export type Role = typeof roles[number];
export interface User { id: number; name: string; email: string; role: Role; active: boolean; createdAt: string }
export interface AccountUser extends User { credentialVersion: number }
export interface PrivateUser extends AccountUser { passwordHash: string }
export interface NewUser { name: string; email: string; password: string; role: Role; active: boolean }
export type UserPatch = Partial<Pick<User, 'name' | 'role' | 'active'>>;
export function publicUser(user: User): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt };
}
export function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function validName(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100; }
export function validEmail(v: unknown): v is string { return typeof v === 'string' && v.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
export function validRole(v: unknown): v is Role { return roles.some(role => role === v); }
export function parseNewUser(value: unknown): NewUser | null {
  if (!isObject(value) || Object.keys(value).length !== 5 || !validName(value.name) || !validEmail(value.email)
    || !validPassword(value.password) || !validRole(value.role) || typeof value.active !== 'boolean') return null;
  return { name: value.name.trim(), email: value.email.trim().toLowerCase(), password: value.password, role: value.role, active: value.active };
}
export function parseUserPatch(value: unknown): UserPatch | null {
  if (!isObject(value) || !Object.keys(value).length || Object.keys(value).some(k => !['name', 'role', 'active'].includes(k))) return null;
  const patch: UserPatch = {};
  if ('name' in value) { if (!validName(value.name)) return null; patch.name = value.name.trim(); }
  if ('role' in value) { if (!validRole(value.role)) return null; patch.role = value.role; }
  if ('active' in value) { if (typeof value.active !== 'boolean') return null; patch.active = value.active; }
  return patch;
}
