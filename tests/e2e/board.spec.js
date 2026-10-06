import { expect, test } from '@playwright/test';

const column = (page, name) => page.getByRole('region', { name, exact: true });
const taskCard = (page, title) => page.getByRole('article', { name: title, exact: true });

async function createTask(page, title) {
  await page.getByRole('button', { name: 'Новая задача' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая задача' });
  await dialog.getByRole('textbox', { name: 'Название' }).fill(title);
  await dialog.getByRole('textbox', { name: 'Исполнитель' }).fill('Влад');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'TaskForge' })).toBeVisible();
});

test('validates a task, creates it, and keeps it after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Новая задача' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая задача' });
  const save = dialog.getByRole('button', { name: 'Сохранить' });

  await expect(save).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Название' }).fill('Проверить фильтры');
  await expect(save).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Исполнитель' }).fill('Влад');
  await expect(save).toBeEnabled();
  await save.click();

  await expect(column(page, 'Бэклог').getByRole('article', { name: 'Проверить фильтры' })).toBeVisible();
  await page.reload();
  await expect(column(page, 'Бэклог').getByRole('article', { name: 'Проверить фильтры' })).toBeVisible();
});

test('edits and deletes a task', async ({ page }) => {
  const original = taskCard(page, 'Собрать требования к кабинету');
  await original.getByRole('button', { name: 'Редактировать задачу' }).click();

  const dialog = page.getByRole('dialog', { name: 'Редактировать задачу' });
  await dialog.getByRole('textbox', { name: 'Название' }).fill('Согласовать требования');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(taskCard(page, 'Согласовать требования')).toBeVisible();
  await expect(original).toHaveCount(0);

  await taskCard(page, 'Согласовать требования').getByRole('button', { name: 'Редактировать задачу' }).click();
  await page.getByRole('dialog', { name: 'Редактировать задачу' }).getByRole('button', { name: 'Удалить' }).click();
  await expect(taskCard(page, 'Согласовать требования')).toHaveCount(0);
});

test('searches, filters by priority, and clears filters', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Поиск задач' }).fill('адаптивный header');
  await expect(taskCard(page, 'Сверстать адаптивный header')).toBeVisible();
  await expect(taskCard(page, 'Добавить фильтры задач')).toHaveCount(0);

  await page.getByRole('button', { name: 'Очистить фильтры' }).click();
  await page.getByRole('combobox', { name: 'Приоритет' }).selectOption({ label: 'Высокий' });
  await expect(taskCard(page, 'Добавить фильтры задач')).toBeVisible();
  await expect(taskCard(page, 'Сверстать адаптивный header')).toHaveCount(0);

  await page.getByRole('button', { name: 'Очистить фильтры' }).click();
  await expect(taskCard(page, 'Сверстать адаптивный header')).toBeVisible();
});

test('moves a task by drag and drop and persists its column', async ({ page }) => {
  const title = 'Собрать требования к кабинету';
  await taskCard(page, title).dragTo(column(page, 'Готово'));
  await expect(column(page, 'Готово').getByRole('article', { name: title })).toBeVisible();

  await page.reload();
  await expect(column(page, 'Готово').getByRole('article', { name: title })).toBeVisible();
  await expect(column(page, 'Бэклог').getByRole('article', { name: title })).toHaveCount(0);
});

test('resets the board only after confirmation', async ({ page }) => {
  await createTask(page, 'Временная задача');
  await expect(taskCard(page, 'Временная задача')).toBeVisible();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Сбросить доску' }).click();
  await expect(taskCard(page, 'Временная задача')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Сбросить доску' }).click();
  await expect(taskCard(page, 'Временная задача')).toHaveCount(0);
  await expect(taskCard(page, 'Собрать требования к кабинету')).toBeVisible();
});
