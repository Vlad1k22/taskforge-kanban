# TaskForge Kanban

TaskForge Kanban - интерактивная Kanban-доска на Vue 3 для управления задачами команды. В моем проекте есть компонентная архитектура, работа с состоянием, формы, фильтры, drag-and-drop и сохранение данных в браузере.

## Возможности

- Создание, редактирование и удаление задач.
- Перемещение задач между колонками через drag-and-drop.
- Поиск по названию, описанию и тегам.
- Фильтры по приоритету, исполнителю, тегу и просроченным задачам.
- Чеклист внутри карточки задачи.
- Дедлайны, оценка времени и исполнители.
- Статистика по доске: всего задач, в работе, просрочено, процент выполнения.
- Сохранение состояния в `localStorage`.
- Адаптивный интерфейс для desktop и mobile.

## Технологии

- Vue 3
- Vite
- JavaScript
- HTML
- CSS
- @lucide/vue
- Playwright Test (e2e)
- GitHub Actions

## Запуск и проверка

```bash
npm ci
npm run dev
```

Приложение откроется по адресу, который покажет Vite. Для e2e-тестов нужен браузер Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright сам запускает локальный Vite-сервер на отдельном порту. Пять сценариев проверяют валидацию и создание задачи, сохранение после перезагрузки, редактирование и удаление, поиск и фильтр, перенос между колонками и сброс с подтверждением. В GitHub Actions тесты запускаются на каждом push в `main` и в pull request.

## Что показывает проект

- Разделение интерфейса на `.vue` компоненты.
- Передачу данных через `props` и пользовательские события через `emit`.
- Использование `ref`, `computed` и `watch`.
- Работу с массивами объектов: фильтрация, группировка, обновление и удаление.
- Нативный drag-and-drop API.
- Формы и простую валидацию.
- Сохранение данных в `localStorage`.
- Подготовку проекта к деплою на GitHub Pages.

## Структура

```text
src/
  assets/
  components/
    AppHeader.vue
    BoardColumn.vue
    FilterBar.vue
    StatsPanel.vue
    TaskCard.vue
    TaskModal.vue
  data/
    initialBoard.js
  utils/
    storage.js
  App.vue
  main.js
  styles.css
tests/e2e/
  board.spec.js
playwright.config.js
```
