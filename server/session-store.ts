import { createHash } from 'node:crypto';
import type { Session } from 'fastify';
import type { SessionStore } from '@fastify/session';
import type { Pool } from 'pg';

const key = (sessionId: string) => createHash('sha256').update(sessionId).digest('hex');

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  set(id: string, session: Session, callback: (error?: unknown) => void) {
    const expires = session.cookie.expires ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.pool.query(`INSERT INTO sessions(id, data, expires_at) VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`,
    [key(id), JSON.stringify(session), expires]).then(() => callback(), callback);
  }

  get(id: string, callback: (error: unknown, session?: Session | null) => void) {
    this.pool.query<{ data: Session }>('SELECT data FROM sessions WHERE id = $1 AND expires_at > now()', [key(id)])
      .then(({ rows }) => {
        const value = rows[0]?.data;
        if (value?.cookie.expires) value.cookie.expires = new Date(String(value.cookie.expires));
        callback(null, value ?? null);
      }, callback);
  }

  destroy(id: string, callback: (error?: unknown) => void) {
    this.pool.query('DELETE FROM sessions WHERE id = $1', [key(id)]).then(() => callback(), callback);
  }
}
