import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    // Evitar los valores implícitos del driver: configurar la conexión por entorno.
    for (const name of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER']) {
      if (!process.env[name]?.trim()) {
        throw new Error('Falta configuración de PostgreSQL.');
      }
    }
    const port = Number(process.env.PGPORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Configuración de puerto PostgreSQL inválida.');
    }
    pool = new Pool({ connectionTimeoutMillis: 5000 });
    // No imprimir detalles de conexión ni errores internos.
    pool.on('error', () => {
      console.error('Error en una conexión inactiva de PostgreSQL.');
    });
  }
  return pool;
}
