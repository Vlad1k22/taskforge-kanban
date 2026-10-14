import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { initialTasks } from '../src/data/initialBoard.js';
import type { TaskDraft } from './schemas.js';

export async function migrate(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL, password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS boards (
      id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS boards_owner_idx ON boards(owner_id);
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY, board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      body JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS tasks_board_idx ON tasks(board_id);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, data JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
  `);
}

export async function transaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seedTasks(client: PoolClient, boardId: string) {
  for (const { id: _id, createdAt: _createdAt, ...draft } of initialTasks) {
    await client.query('INSERT INTO tasks(id, board_id, body) VALUES ($1, $2, $3)', [randomUUID(), boardId, draft]);
  }
}

export interface TaskRow { id: string; body: TaskDraft; created_at: Date }
export function taskDto(row: TaskRow) {
  return { ...row.body, id: row.id, createdAt: row.created_at.toISOString() };
}
