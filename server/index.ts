import 'dotenv/config';
import { resolve } from 'node:path';
import pg from 'pg';
import { createApp } from './app.js';
import { migrate } from './database.js';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) throw new Error('Set SESSION_SECRET to at least 32 characters (see .env.example)');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL (see .env.example)');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
pool.on('error', (error) => console.error('PostgreSQL pool error:', error.message));

await migrate(pool);
const app = await createApp({ pool, sessionSecret, logger: true,
  origins: (process.env.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001').split(',').map((origin) => origin.trim()),
  secureCookie: process.env.SECURE_COOKIE === 'true',
  staticDir: process.env.SERVE_STATIC === 'true' ? resolve('dist') : undefined,
});
await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => { await app.close(); await pool.end(); });
}
