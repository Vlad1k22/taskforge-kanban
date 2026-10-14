import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

async function register(page) {
  const email = `${randomUUID()}@example.com`;
  await page.goto('./');
  await page.getByRole('tab', { name: 'Регистрация' }).click();
  await page.getByRole('textbox', { name: 'Имя', exact: true }).fill('Влад');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('button', { name: 'Новая задача', exact: true })).toBeEnabled();
  await expect(page.getByText('Подключено', { exact: true })).toBeVisible();
  return email;
}
async function fillTask(page, title) {
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая задача' });
  await dialog.getByRole('textbox', { name: 'Название' }).fill(title);
  await dialog.getByRole('textbox', { name: 'Исполнитель' }).fill('Влад');
  return dialog;
}

test('registration, server persistence, board selection and login', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Новая доска', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название доски' }).fill('Новый спринт');
  await page.getByRole('button', { name: 'Создать доску' }).click();
  await expect(page.getByRole('combobox', { name: 'Доска', exact: true }).locator('option:checked')).toHaveText('Новый спринт');
  const dialog = await fillTask(page, 'Серверная задача');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('article', { name: 'Серверная задача' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article', { name: 'Серверная задача' })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Серверная задача' })).toBeVisible();
  await page.screenshot({ path: 'test-results-fullstack/desktop.png', fullPage: true });
});

test('pushes changes to another tab and propagates logout', async ({ page, context }) => {
  await register(page);
  const second = await context.newPage();
  await second.goto('./');
  await expect(second.getByText('Подключено', { exact: true })).toBeVisible();
  const dialog = await fillTask(page, 'Обновление в реальном времени');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(second.getByRole('article', { name: 'Обновление в реальном времени' })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
});

test('reloads missed changes after the connection is restored', async ({ page, context }) => {
  await register(page);
  const boardId = await page.getByRole('combobox', { name: 'Доска', exact: true }).inputValue();
  const origin = new URL(page.url()).origin;
  await context.setOffline(true);
  await expect(page.getByText('Нет соединения', { exact: true })).toBeVisible();
  const response = await context.request.post(`${origin}/api/boards/${boardId}/tasks`, {
    headers: { 'X-TaskForge-Request': '1', Origin: origin },
    data: { title: 'Пропущенное событие', description: '', columnId: 'backlog', priority: 'medium', assignee: 'Влад', dueDate: '', estimate: 1, tags: [], subtasks: [] },
  });
  expect(response.status()).toBe(201);
  await context.setOffline(false);
  await expect(page.getByText('Подключено', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('article', { name: 'Пропущенное событие' })).toBeVisible();
});

test('keeps the form on server failure and allows retry', async ({ page }) => {
  await register(page);
  const dialog = await fillTask(page, 'Повторная отправка');
  await page.route('**/api/boards/*/tasks', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 503, json: { error: { message: 'Временно недоступно' } } });
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Временно недоступно');
  await expect(dialog.getByRole('textbox', { name: 'Название' })).toHaveValue('Повторная отправка');
  await page.unroute('**/api/boards/*/tasks');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('article', { name: 'Повторная отправка' })).toBeVisible();
});

test('mobile account and board controls stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await expect(page.getByRole('combobox', { name: 'Доска', exact: true })).toBeVisible();
  const dialog = await fillTask(page, 'Мобильная задача');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('article', { name: 'Мобильная задача' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results-fullstack/mobile.png', fullPage: true });
});

test('edits, moves and deletes a task through the real API', async ({ page }) => {
  await register(page);
  let dialog = await fillTask(page, 'Полный жизненный цикл');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  let card = page.getByRole('article', { name: 'Полный жизненный цикл' });
  await card.getByRole('button', { name: 'Редактировать задачу' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Название' }).fill('Отредактированная задача');
  await dialog.getByRole('combobox', { name: 'Колонка' }).selectOption('done');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  card = page.getByRole('article', { name: 'Отредактированная задача' });
  await expect(page.getByRole('region', { name: 'Готово', exact: true }).getByRole('article', { name: 'Отредактированная задача' })).toBeVisible();
  await card.getByRole('button', { name: 'Редактировать задачу' }).click();
  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Подключено', { exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
});
