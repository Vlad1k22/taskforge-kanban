<script setup>
import { computed, ref, watch } from 'vue';
import { Plus, RefreshCw, X } from '@lucide/vue';
import AppHeader from './components/AppHeader.vue';
import AuthPanel from './components/AuthPanel.vue';
import BoardColumn from './components/BoardColumn.vue';
import FilterBar from './components/FilterBar.vue';
import StatsPanel from './components/StatsPanel.vue';
import TaskModal from './components/TaskModal.vue';
import { columns, priorities } from './data/initialBoard';
import { remoteEnabled } from './api/client';
import { useWorkspace } from './composables/useWorkspace';

const workspace = useWorkspace();
const { tasks, user, boards, boardId, loading, mutating, error, realtimeStatus } = workspace;
const emptyFilters = () => ({ search: '', priority: 'all', assignee: 'all', tag: 'all', onlyOverdue: false });
const filters = ref(emptyFilters());
const draggedTaskId = ref(null);
const modalOpen = ref(false);
const selectedTask = ref(null);
const creatingBoard = ref(false);
const boardName = ref('');
watch(user, (value) => {
  if (remoteEnabled && !value) {
    modalOpen.value = false; selectedTask.value = null; creatingBoard.value = false;
    filters.value = emptyFilters();
  }
});
const priorityMap = computed(() => Object.fromEntries(priorities.map((priority) => [priority.value, priority.label])));
const assignees = computed(() => [...new Set(tasks.value.map((task) => task.assignee).filter(Boolean))].sort());
const tags = computed(() => [...new Set(tasks.value.flatMap((task) => task.tags))].sort());
const overdueIds = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Set(tasks.value.filter((task) => task.columnId !== 'done' && task.dueDate && new Date(task.dueDate) < today).map((task) => task.id));
});
const filteredTasks = computed(() => {
  const query = filters.value.search.trim().toLowerCase();
  return tasks.value.filter((task) => {
    const search = !query || task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query) || task.tags.some((tag) => tag.includes(query));
    return search && (filters.value.priority === 'all' || task.priority === filters.value.priority)
      && (filters.value.assignee === 'all' || task.assignee === filters.value.assignee)
      && (filters.value.tag === 'all' || task.tags.includes(filters.value.tag))
      && (!filters.value.onlyOverdue || overdueIds.value.has(task.id));
  });
});
const tasksByColumn = computed(() => Object.fromEntries(columns.map((column) => [column.id, filteredTasks.value.filter((task) => task.columnId === column.id)])));
const stats = computed(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((task) => task.columnId === 'done').length;
  return { total, active: total - done, overdue: overdueIds.value.size, progress: total ? Math.round(done / total * 100) : 0 };
});
function openCreateModal(columnId = 'backlog') {
  if (loading.value || mutating.value) return;
  error.value = '';
  selectedTask.value = { id: '', title: '', description: '', columnId, priority: 'medium', assignee: '', dueDate: '', estimate: 1, tags: [], subtasks: [] };
  modalOpen.value = true;
}
function openEditModal(task) {
  if (mutating.value) return;
  error.value = ''; selectedTask.value = task; modalOpen.value = true;
}
function closeModal() { if (!mutating.value) { modalOpen.value = false; selectedTask.value = null; } }
async function saveTask(payload) { if (await workspace.saveTask(payload)) closeModal(); }
async function deleteTask(id) { if (await workspace.deleteTask(id)) closeModal(); }
async function dropTask(columnId) {
  const id = draggedTaskId.value; draggedTaskId.value = null;
  if (id && !mutating.value) await workspace.moveTask(id, columnId);
}
function clearFilters() { filters.value = emptyFilters(); }
async function resetBoard() {
  if (window.confirm('Сбросить доску к демо-данным?') && await workspace.reset()) clearFilters();
}
async function createBoard() {
  if (await workspace.createBoard(boardName.value.trim())) { creatingBoard.value = false; boardName.value = ''; clearFilters(); }
}
async function selectBoard(event) { clearFilters(); await workspace.selectBoard(event.target.value); }
</script>
<template>
  <div class="app-shell">
    <AppHeader :total-tasks="tasks.length" :user="user" :editable="!remoteEnabled || Boolean(user)" :busy="loading || mutating"
      @create-task="openCreateModal" @reset-board="resetBoard" @logout="workspace.logout" />
    <main>
      <AuthPanel v-if="remoteEnabled && !user && !loading" :busy="mutating" :error="error" @submit="workspace.authenticate" />
      <p v-else-if="remoteEnabled && !user" class="workspace-status" role="status">Загрузка…</p>
      <template v-else>
        <section class="intro-panel" aria-labelledby="page-title">
          <div><span>Kanban Board</span><h1 id="page-title">TaskForge</h1></div>
          <p v-if="!remoteEnabled">Управление задачами команды с фильтрами, дедлайнами, чеклистами и сохранением состояния.</p>
          <div v-else class="workspace-controls">
            <label>Доска<select :value="boardId" :disabled="loading || mutating" @change="selectBoard"><option v-for="board in boards" :key="board.id" :value="board.id">{{ board.name }}</option></select></label>
            <button class="icon-button" type="button" title="Новая доска" aria-label="Новая доска" :disabled="mutating" @click="creatingBoard = !creatingBoard"><Plus :size="20" /></button>
            <span class="connection-status" :class="{ connected: realtimeStatus === 'connected' }" role="status">{{ realtimeStatus === 'connected' ? 'Подключено' : realtimeStatus === 'connecting' ? 'Подключение…' : 'Нет соединения' }}</span>
          </div>
        </section>
        <form v-if="creatingBoard" class="new-board-form" @submit.prevent="createBoard">
          <label>Название доски<input v-model="boardName" minlength="2" maxlength="80" required /></label>
          <button class="button button--primary" :disabled="mutating" type="submit">Создать доску</button>
          <button class="icon-button" type="button" title="Отмена" aria-label="Отмена" @click="creatingBoard = false"><X :size="18" /></button>
        </form>
        <div v-if="error && !modalOpen" class="workspace-error" role="alert">{{ error }}<button v-if="remoteEnabled" class="icon-button" type="button" aria-label="Повторить загрузку" title="Повторить загрузку" @click="workspace.reload"><RefreshCw :size="18" /></button></div>
        <p v-if="loading" class="workspace-status" role="status">Загрузка задач…</p>
        <StatsPanel :stats="stats" />
        <FilterBar :filters="filters" :priorities="priorities" :assignees="assignees" :tags="tags" @update:filters="filters = $event" @clear="clearFilters" />
        <section class="board" aria-label="Kanban доска" :aria-busy="loading || mutating">
          <BoardColumn v-for="column in columns" :key="column.id" :column="column" :columns="columns" :tasks="tasksByColumn[column.id]"
            :priority-map="priorityMap" :overdue-ids="overdueIds" @create-task="openCreateModal" @edit-task="openEditModal"
            @drag-start="draggedTaskId = $event" @task-drop="dropTask" />
        </section>
      </template>
    </main>
    <TaskModal :open="modalOpen" :task="selectedTask" :columns="columns" :priorities="priorities" :busy="mutating" :error="error"
      @close="closeModal" @save="saveTask" @delete="deleteTask" />
  </div>
</template>
