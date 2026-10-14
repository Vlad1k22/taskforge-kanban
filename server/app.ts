import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import websocket from '@fastify/websocket';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PostgresSessionStore } from './session-store.js';
import { hashPassword, verifyPassword } from './password.js';
import { seedTasks, taskDto, transaction, type TaskRow } from './database.js';
import { RealtimeHub } from './realtime.js';
import { boardParams, boardSchema, loginSchema, moveSchema, normalizeTask, registerSchema, taskParams, taskSchema } from './schemas.js';

declare module 'fastify' { interface Session { userId?: string } }

interface Options {
  pool: Pool;
  sessionSecret: string;
  origins: string[];
  secureCookie?: boolean;
  staticDir?: string;
  logger?: boolean;
  rateLimit?: boolean;
}
interface UserRow { id: string; email: string; display_name: string; password_hash: string }
const publicUser = (row: UserRow) => ({ id: row.id, email: row.email, displayName: row.display_name });

export async function createApp(options: Options) {
  const { pool } = options;
  const app = Fastify({ bodyLimit: 32 * 1024, logger: options.logger ? {
    redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password'],
  } : false, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } }).withTypeProvider<TypeBoxTypeProvider>();
  const hub = new RealtimeHub();
  const origins = new Set(options.origins);
  await app.register(sensible);
  await app.register(cookie);
  await app.register(session, {
    secret: options.sessionSecret, cookieName: 'taskforge.sid', store: new PostgresSessionStore(pool),
    saveUninitialized: false, rolling: false,
    cookie: { path: '/', httpOnly: true, sameSite: 'strict', secure: options.secureCookie ?? false, maxAge: 24 * 60 * 60 * 1000 },
  });
  if (options.rateLimit !== false) await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(websocket, { options: { maxPayload: 4096 } });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (request.headers.origin && !origins.has(request.headers.origin)) throw app.httpErrors.forbidden('Недопустимый источник запроса');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers['x-taskforge-request'] !== '1') {
      throw app.httpErrors.forbidden('Отсутствует защитный заголовок запроса');
    }
  });
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.validation ? 400 : (error.statusCode ?? 500);
    if (status >= 500) request.log.error(error);
    reply.code(status).send({ error: {
      code: error.validation ? 'VALIDATION_ERROR' : (error.code ?? `HTTP_${status}`),
      message: error.validation ? 'Проверьте заполнение полей' : status >= 500 ? 'Ошибка сервера. Попробуйте позже' : error.message,
    } });
  });
  const requireUser = (request: FastifyRequest) => {
    if (!request.session.userId) throw app.httpErrors.unauthorized('Войдите в аккаунт');
    return request.session.userId;
  };
  const ownedBoard = async (boardId: string, ownerId: string) => {
    const { rows } = await pool.query('SELECT id, name FROM boards WHERE id = $1 AND owner_id = $2', [boardId, ownerId]);
    if (!rows[0]) throw app.httpErrors.notFound('Доска не найдена');
    return rows[0] as { id: string; name: string };
  };
  const authLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  app.get('/api/health', async () => { await pool.query('SELECT 1'); return { status: 'ok' }; });
  app.post('/api/auth/register', { schema: { body: registerSchema }, config: authLimit }, async (request, reply) => {
    const displayName = request.body.displayName.trim();
    if (displayName.length < 2) throw app.httpErrors.badRequest('Имя должно содержать минимум 2 символа');
    const email = request.body.email.toLowerCase();
    const passwordHash = await hashPassword(request.body.password);
    let user: UserRow;
    try {
      user = await transaction(pool, async (client) => {
        const { rows } = await client.query<UserRow>(`INSERT INTO users(id, email, display_name, password_hash)
          VALUES ($1, $2, $3, $4) RETURNING *`, [randomUUID(), email, displayName, passwordHash]);
        const boardId = randomUUID();
        await client.query('INSERT INTO boards(id, owner_id, name) VALUES ($1, $2, $3)', [boardId, rows[0].id, 'Моя доска']);
        await seedTasks(client, boardId);
        return rows[0];
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw app.httpErrors.conflict('Email уже зарегистрирован');
      throw error;
    }
    hub.closeSession(request.session.sessionId);
    await request.session.regenerate();
    request.session.userId = user.id;
    await request.session.save();
    return reply.code(201).send({ user: publicUser(user) });
  });
  app.post('/api/auth/login', { schema: { body: loginSchema }, config: authLimit }, async (request) => {
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [request.body.email.toLowerCase()]);
    if (!rows[0] || !await verifyPassword(request.body.password, rows[0].password_hash)) {
      throw app.httpErrors.unauthorized('Неверный email или пароль');
    }
    hub.closeSession(request.session.sessionId);
    await request.session.regenerate();
    request.session.userId = rows[0].id;
    await request.session.save();
    return { user: publicUser(rows[0]) };
  });
  app.get('/api/auth/me', async (request) => {
    const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [requireUser(request)]);
    if (!rows[0]) throw app.httpErrors.unauthorized('Войдите в аккаунт');
    return { user: publicUser(rows[0]) };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    requireUser(request);
    const sessionId = request.session.sessionId;
    await request.session.destroy();
    hub.closeSession(sessionId);
    return reply.clearCookie('taskforge.sid', { path: '/' }).code(204).send();
  });
  app.get('/api/boards', async (request) => {
    const { rows } = await pool.query('SELECT id, name FROM boards WHERE owner_id = $1 ORDER BY created_at, id', [requireUser(request)]);
    return { boards: rows };
  });
  app.post('/api/boards', { schema: { body: boardSchema } }, async (request, reply) => {
    const name = request.body.name.trim();
    if (name.length < 2) throw app.httpErrors.badRequest('Название доски должно содержать минимум 2 символа');
    const { rows } = await pool.query('INSERT INTO boards(id, owner_id, name) VALUES ($1, $2, $3) RETURNING id, name',
      [randomUUID(), requireUser(request), name]);
    return reply.code(201).send({ board: rows[0] });
  });
  app.get('/api/boards/:boardId/tasks', { schema: { params: boardParams } }, async (request) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    const { rows } = await pool.query<TaskRow>('SELECT id, body, created_at FROM tasks WHERE board_id = $1 ORDER BY created_at, id', [request.params.boardId]);
    return { tasks: rows.map(taskDto) };
  });
  app.post('/api/boards/:boardId/tasks', { schema: { params: boardParams, body: taskSchema } }, async (request, reply) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    const draft = normalizeTask(request.body);
    if (draft.title.length < 3 || draft.assignee.length < 2) throw app.httpErrors.badRequest('Проверьте название и исполнителя');
    const { rows } = await pool.query<TaskRow>('INSERT INTO tasks(id, board_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
      [randomUUID(), request.params.boardId, draft]);
    hub.publish(request.params.boardId);
    return reply.code(201).send({ task: taskDto(rows[0]) });
  });
  app.put('/api/boards/:boardId/tasks/:taskId', { schema: { params: taskParams, body: taskSchema } }, async (request) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    const draft = normalizeTask(request.body);
    if (draft.title.length < 3 || draft.assignee.length < 2) throw app.httpErrors.badRequest('Проверьте название и исполнителя');
    const { rows } = await pool.query<TaskRow>('UPDATE tasks SET body = $1 WHERE id = $2 AND board_id = $3 RETURNING id, body, created_at',
      [draft, request.params.taskId, request.params.boardId]);
    if (!rows[0]) throw app.httpErrors.notFound('Задача не найдена');
    hub.publish(request.params.boardId);
    return { task: taskDto(rows[0]) };
  });
  app.patch('/api/boards/:boardId/tasks/:taskId', { schema: { params: taskParams, body: moveSchema } }, async (request) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    const { rows } = await pool.query<TaskRow>(`UPDATE tasks SET body = jsonb_set(body, '{columnId}', $1::jsonb)
      WHERE id = $2 AND board_id = $3 RETURNING id, body, created_at`,
    [JSON.stringify(request.body.columnId), request.params.taskId, request.params.boardId]);
    if (!rows[0]) throw app.httpErrors.notFound('Задача не найдена');
    hub.publish(request.params.boardId);
    return { task: taskDto(rows[0]) };
  });
  app.delete('/api/boards/:boardId/tasks/:taskId', { schema: { params: taskParams } }, async (request, reply) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1 AND board_id = $2', [request.params.taskId, request.params.boardId]);
    if (!rowCount) throw app.httpErrors.notFound('Задача не найдена');
    hub.publish(request.params.boardId);
    return reply.code(204).send();
  });
  app.post('/api/boards/:boardId/reset', { schema: { params: boardParams } }, async (request, reply) => {
    await ownedBoard(request.params.boardId, requireUser(request));
    await transaction(pool, async (client) => {
      await client.query('SELECT id FROM boards WHERE id = $1 FOR UPDATE', [request.params.boardId]);
      await client.query('DELETE FROM tasks WHERE board_id = $1', [request.params.boardId]);
      await seedTasks(client, request.params.boardId);
    });
    hub.publish(request.params.boardId);
    return reply.code(204).send();
  });
  app.get('/api/boards/:boardId/events', { websocket: true, schema: { params: boardParams }, preHandler: async (request) => {
    if (!request.headers.origin || !origins.has(request.headers.origin)) throw app.httpErrors.forbidden('Недопустимый источник WebSocket');
    await ownedBoard(request.params.boardId, requireUser(request));
  } }, (socket, request) => {
    hub.subscribe(socket, request.params.boardId, request.session.sessionId,
      request.session.cookie.expires?.getTime() ?? Date.now() + 24 * 60 * 60 * 1000);
  });

  const cleanup = setInterval(() => {
    pool.query('DELETE FROM sessions WHERE expires_at <= now()').catch((error: unknown) => app.log.error(error));
  }, 5 * 60 * 1000).unref();
  app.addHook('preClose', async () => { hub.close(); clearInterval(cleanup); });
  if (options.staticDir) {
    await app.register(staticFiles, { root: options.staticDir, prefix: '/taskforge-kanban/' });
    app.get('/', (_request, reply) => reply.redirect('/taskforge-kanban/'));
  }
  return app;
}
