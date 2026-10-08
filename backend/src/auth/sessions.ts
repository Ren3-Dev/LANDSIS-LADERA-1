import { createHash, randomBytes } from 'node:crypto';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionAgeSeconds = 8 * 60 * 60;
export class Sessions {
  private entries = new Map<string, { userId: number; expires: number }>();
  constructor(private now: () => number = Date.now) {}
  create(userId: number): string {
    for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(key);
    if (this.entries.size >= 1000) throw new Error('Session capacity');
    const token = randomBytes(32).toString('hex');
    this.entries.set(digest(token), { userId, expires: this.now() + sessionAgeSeconds * 1000 }); return token;
  }
  userId(token: string): number | null {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const entry = this.entries.get(digest(token));
    if (!entry || entry.expires <= this.now()) { this.entries.delete(digest(token)); return null; }
    return entry.userId;
  }
  delete(token: string): void { this.entries.delete(digest(token)); }
}
