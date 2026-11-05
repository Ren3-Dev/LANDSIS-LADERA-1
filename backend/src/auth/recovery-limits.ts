// Ventanas fijas locales: ninguna clave depende de la existencia de una cuenta.
export class RecoveryLimit {
  private entries = new Map<string, { count: number; expires: number }>();
  constructor(private max: number, private now: () => number = Date.now) {}
  take(key: string): boolean {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.expires <= now) this.entries.delete(id);
    const previous = this.entries.get(key);
    if ((!previous && this.entries.size >= 1000) || (previous && previous.count >= this.max)) return false;
    this.entries.set(key, { count: (previous?.count ?? 0) + 1, expires: previous?.expires ?? now + 15 * 60 * 1000 });
    return true;
  }
}

export class RecoveryQueue {
  private jobs: Array<() => Promise<void>> = [];
  private active = 0;
  constructor(private onFailure: () => void = () => {}) {}
  enqueue(job: () => Promise<void>): void {
    if (this.jobs.length + this.active >= 20) return;
    this.jobs.push(job);
    // No ejecutar consultas o SMTP antes de devolver la respuesta HTTP.
    setImmediate(() => this.run());
  }
  private run(): void {
    while (this.active < 2 && this.jobs.length) {
      const job = this.jobs.shift()!;
      this.active++;
      Promise.resolve().then(job).catch(() => {
        // El callback no recibe excepciones, destinatarios, tokens ni mensajes.
        try { this.onFailure(); } catch { /* No permitir rechazos sin manejar. */ }
      }).finally(() => { this.active--; this.run(); });
    }
  }
}
