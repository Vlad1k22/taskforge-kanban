import { Type, type Static } from '@fastify/type-provider-typebox';

export const columnSchema = Type.Union(['backlog', 'todo', 'progress', 'review', 'done'].map((value) => Type.Literal(value)));
export const boardParams = Type.Object({ boardId: Type.String({ format: 'uuid' }) });
export const taskParams = Type.Object({ boardId: Type.String({ format: 'uuid' }), taskId: Type.String({ format: 'uuid' }) });
export const boardSchema = Type.Object({ name: Type.String({ minLength: 2, maxLength: 80, pattern: '\\S' }) }, { additionalProperties: false });
export const loginSchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
  password: Type.String({ minLength: 10, maxLength: 128 }),
}, { additionalProperties: false });
export const registerSchema = Type.Object({
  ...loginSchema.properties,
  displayName: Type.String({ minLength: 2, maxLength: 80, pattern: '\\S' }),
}, { additionalProperties: false });
export const taskSchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 160, pattern: '\\S' }),
  description: Type.String({ maxLength: 3000 }),
  columnId: columnSchema,
  priority: Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')]),
  assignee: Type.String({ minLength: 2, maxLength: 80, pattern: '\\S' }),
  dueDate: Type.Union([Type.String({ format: 'date' }), Type.Literal('')]),
  estimate: Type.Integer({ minimum: 1, maximum: 40 }),
  tags: Type.Array(Type.String({ minLength: 1, maxLength: 32, pattern: '\\S' }), { maxItems: 20 }),
  subtasks: Type.Array(Type.Object({
    id: Type.String({ minLength: 1, maxLength: 100 }),
    title: Type.String({ minLength: 1, maxLength: 200, pattern: '\\S' }),
    done: Type.Boolean(),
  }, { additionalProperties: false }), { maxItems: 50 }),
}, { additionalProperties: false });
export const moveSchema = Type.Object({ columnId: columnSchema }, { additionalProperties: false });
export type TaskDraft = Static<typeof taskSchema>;

export function normalizeTask(task: TaskDraft): TaskDraft {
  return { ...task, title: task.title.trim(), description: task.description.trim(), assignee: task.assignee.trim(),
    tags: [...new Set(task.tags.map((tag) => tag.trim().toLowerCase()))],
    subtasks: task.subtasks.map((item) => ({ ...item, title: item.title.trim() })) };
}
