import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../app.js';
import { migrate } from '../database.js';
import type { TaskDraft } from '../schemas.js';

const connectionString = process.env.TEST_DATABASE_URL ?? 'postgresql://taskforge:taskforge@127.0.0.1:5434/taskforge';
const admin = new pg.Pool({ connectionString });
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
const options = { pool, sessionSecret: 'integration-tests-only-session-secret-123456', origins: ['http://taskforge.test'], rateLimit: false };
let app: Awaited<ReturnType<typeof createApp>>;
const headers = { 'x-taskforge-request': '1', origin: 'http://taskforge.test' };
const task: TaskDraft = { title: 'API test task', description: '', columnId: 'backlog', priority: 'medium', assignee: 'Vlad', dueDate: '', estimate: 2, tags: ['api'], subtasks: [] };

before(async () => {
  // The generated schema isolates tests from existing application data.
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await migrate(pool);
  app = await createApp(options);
  await app.ready();
});
after(async () => {
  if (app) await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
});

async function account() {
  const email = `${randomUUID()}@example.com`;
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', headers,
    payload: { email, password: 'test-password-123', displayName: 'Vlad' } });
  assert.equal(response.statusCode, 201, response.body);
  const cookieHeader = response.headers['set-cookie'];
  const cookie = (Array.isArray(cookieHeader) ? cookieHeader.at(-1)! : cookieHeader!).split(';')[0];
  const boards = await app.inject({ url: '/api/boards', headers: { cookie } });
  return { email, cookie, userId: response.json().user.id, boardId: boards.json().boards[0].id as string };
}

test('registration, validation, password hashing and login session rotation', async () => {
  const owner = await account();
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [owner.userId]);
  assert.notEqual(rows[0].password_hash, 'test-password-123');
  assert.match(rows[0].password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
  const me = await app.inject({ url: '/api/auth/me', headers: { cookie: owner.cookie } });
  assert.deepEqual(Object.keys(me.json().user).sort(), ['displayName', 'email', 'id']);
  const duplicate = await app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: { email: owner.email, password: 'test-password-123', displayName: 'Vlad' } });
  assert.equal(duplicate.statusCode, 409);
  const short = await app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: { email: 'a@example.com', password: 'short', displayName: 'Vlad' } });
  assert.equal(short.statusCode, 400);
  const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { email: owner.email, password: 'wrong-password' } });
  assert.equal(wrong.statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { ...headers, cookie: owner.cookie }, payload: { email: owner.email, password: 'test-password-123' } });
  assert.equal(login.statusCode, 200);
  assert.match(String(login.headers['set-cookie']), /HttpOnly/i);
  assert.match(String(login.headers['set-cookie']), /SameSite=Strict/i);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: owner.cookie } })).statusCode, 401);
});

test('rejects unauthenticated requests, foreign origins and missing CSRF header', async () => {
  assert.equal((await app.inject({ url: '/api/boards' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { ...headers, origin: 'https://evil.example' }, payload: {} })).statusCode, 403);
});

test('task CRUD, column movement, strict schemas and missing task handling', async () => {
  const owner = await account();
  const auth = { ...headers, cookie: owner.cookie };
  const url = `/api/boards/${owner.boardId}/tasks`;
  const created = await app.inject({ method: 'POST', url, headers: auth, payload: task });
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().task.id;
  assert.equal(created.json().task.title, task.title);
  assert.equal((await app.inject({ method: 'PUT', url: `${url}/${id}`, headers: auth, payload: { ...task, title: 'Edited task' } })).statusCode, 200);
  const moved = await app.inject({ method: 'PATCH', url: `${url}/${id}`, headers: auth, payload: { columnId: 'done' } });
  assert.equal(moved.json().task.columnId, 'done');
  for (const invalid of [{ ...task, estimate: 0 }, { ...task, title: '   ' }, { ...task, dueDate: '2026-02-31' }, { ...task, ownerId: owner.userId }]) {
    assert.equal((await app.inject({ method: 'POST', url, headers: auth, payload: invalid })).statusCode, 400);
  }
  assert.equal((await app.inject({ method: 'DELETE', url: `${url}/${id}`, headers: auth })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: `${url}/${id}`, headers: auth })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/boards/invalid/tasks', headers: auth })).statusCode, 400);
});

test('enforces ownership on every task endpoint, reset and board lists', async () => {
  const alice = await account();
  const bob = await account();
  const own = { ...headers, cookie: alice.cookie };
  const outsider = { ...headers, cookie: bob.cookie };
  const url = `/api/boards/${alice.boardId}/tasks`;
  const created = await app.inject({ method: 'POST', url, headers: own, payload: task });
  const taskId = created.json().task.id;
  for (const [method, path, payload] of [
    ['GET', url], ['POST', url, task], ['PUT', `${url}/${taskId}`, task],
    ['PATCH', `${url}/${taskId}`, { columnId: 'done' }], ['DELETE', `${url}/${taskId}`],
    ['POST', `/api/boards/${alice.boardId}/reset`],
  ] as const) {
    const response = await app.inject({ method, url: path, headers: outsider, payload });
    assert.equal(response.statusCode, 404, `${method} ${response.body}`);
  }
  const list = await app.inject({ url: '/api/boards', headers: outsider });
  assert.equal(list.json().boards.some((board: { id: string }) => board.id === alice.boardId), false);
});

test('creates an empty board and resets only the selected board', async () => {
  const owner = await account();
  const auth = { ...headers, cookie: owner.cookie };
  const created = await app.inject({ method: 'POST', url: '/api/boards', headers: auth, payload: { name: 'Second board' } });
  const secondId = created.json().board.id;
  const secondTasks = `/api/boards/${secondId}/tasks`;
  assert.equal((await app.inject({ url: secondTasks, headers: auth })).json().tasks.length, 0);
  await app.inject({ method: 'POST', url: secondTasks, headers: auth, payload: task });
  assert.equal((await app.inject({ method: 'POST', url: `/api/boards/${owner.boardId}/reset`, headers: auth })).statusCode, 204);
  assert.equal((await app.inject({ url: secondTasks, headers: auth })).json().tasks.length, 1);
  assert.equal((await app.inject({ url: `/api/boards/${owner.boardId}/tasks`, headers: auth })).json().tasks.length, 5);
});

test('persists tasks and sessions across independent server instances', async () => {
  const owner = await account();
  const auth = { ...headers, cookie: owner.cookie };
  const url = `/api/boards/${owner.boardId}/tasks`;
  await app.inject({ method: 'POST', url, headers: auth, payload: task });
  const second = await createApp(options);
  try {
    assert.equal((await second.inject({ url: '/api/auth/me', headers: auth })).statusCode, 200);
    const tasks = (await second.inject({ url, headers: auth })).json().tasks;
    assert.equal(tasks.some((item: { title: string }) => item.title === task.title), true);
  } finally { await second.close(); }
});

test('authenticates WebSocket subscriptions and delivers board change notifications', async () => {
  const owner = await account();
  const outsider = await account();
  const path = `/api/boards/${owner.boardId}/events`;
  await assert.rejects(app.injectWS(path, { headers: { origin: headers.origin, cookie: outsider.cookie } }), /404/);
  await assert.rejects(app.injectWS(path, { headers: { cookie: owner.cookie } }), /403/);
  const socket = await app.injectWS(path, { headers: { origin: headers.origin, cookie: owner.cookie } });
  try {
    const notification = once(socket, 'message');
    await app.inject({ method: 'POST', url: `/api/boards/${owner.boardId}/tasks`, headers: { ...headers, cookie: owner.cookie }, payload: task });
    const [data] = await notification;
    assert.deepEqual(JSON.parse(data.toString()), { type: 'board.changed', boardId: owner.boardId });
  } finally { socket.terminate(); }
});

test('logout revokes the cookie and closes its WebSocket; expired sessions are rejected', async () => {
  const owner = await account();
  const auth = { ...headers, cookie: owner.cookie };
  const socket = await app.injectWS(`/api/boards/${owner.boardId}/events`, { headers: auth });
  const closed = once(socket, 'close');
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth })).statusCode, 204);
  const [code] = await closed;
  assert.equal(code, 1008);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: auth })).statusCode, 401);
  const expired = await account();
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE data->>'userId'=$1", [expired.userId]);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: expired.cookie } })).statusCode, 401);
});
