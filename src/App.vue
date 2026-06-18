<script setup>
import { computed, ref, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import BoardColumn from './components/BoardColumn.vue';
import FilterBar from './components/FilterBar.vue';
import StatsPanel from './components/StatsPanel.vue';
import TaskModal from './components/TaskModal.vue';
import { columns, initialTasks, priorities } from './data/initialBoard';
import { clearBoardState, loadBoardState, saveBoardState } from './utils/storage';

const savedState = loadBoardState();

const tasks = ref(savedState?.tasks || initialTasks);
const filters = ref({
  search: '',
  priority: 'all',
  assignee: 'all',
  tag: 'all',
  onlyOverdue: false,
});
const draggedTaskId = ref(null);
const modalOpen = ref(false);
const selectedTask = ref(null);

const priorityMap = computed(() =>
  priorities.reduce((map, priority) => {
    map[priority.value] = priority.label;
    return map;
  }, {}),
);

const assignees = computed(() => [...new Set(tasks.value.map((task) => task.assignee).filter(Boolean))].sort());

const tags = computed(() => [...new Set(tasks.value.flatMap((task) => task.tags))].sort());

const overdueIds = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Set(
    tasks.value
      .filter((task) => task.columnId !== 'done' && task.dueDate && new Date(task.dueDate) < today)
      .map((task) => task.id),
  );
});

const filteredTasks = computed(() => {
  const query = filters.value.search.trim().toLowerCase();

  return tasks.value.filter((task) => {
    const matchesSearch =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.tags.some((tag) => tag.includes(query));

    const matchesPriority = filters.value.priority === 'all' || task.priority === filters.value.priority;
    const matchesAssignee = filters.value.assignee === 'all' || task.assignee === filters.value.assignee;
    const matchesTag = filters.value.tag === 'all' || task.tags.includes(filters.value.tag);
    const matchesOverdue = !filters.value.onlyOverdue || overdueIds.value.has(task.id);

    return matchesSearch && matchesPriority && matchesAssignee && matchesTag && matchesOverdue;
  });
});

const tasksByColumn = computed(() =>
  columns.reduce((map, column) => {
    map[column.id] = filteredTasks.value.filter((task) => task.columnId === column.id);
    return map;
  }, {}),
);

const stats = computed(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((task) => task.columnId === 'done').length;

  return {
    total,
    active: tasks.value.filter((task) => task.columnId !== 'done').length,
    overdue: overdueIds.value.size,
    progress: total ? Math.round((done / total) * 100) : 0,
  };
});

watch(
  tasks,
  (nextTasks) => {
    saveBoardState({ tasks: nextTasks });
  },
  { deep: true },
);

function openCreateModal(columnId = 'backlog') {
  selectedTask.value = {
    id: '',
    title: '',
    description: '',
    columnId,
    priority: 'medium',
    assignee: '',
    dueDate: '',
    estimate: 1,
    tags: [],
    subtasks: [],
  };
  modalOpen.value = true;
}

function openEditModal(task) {
  selectedTask.value = structuredClone(task);
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
  selectedTask.value = null;
}

function saveTask(taskPayload) {
  if (taskPayload.id) {
    tasks.value = tasks.value.map((task) => (task.id === taskPayload.id ? { ...task, ...taskPayload } : task));
  } else {
    tasks.value = [
      ...tasks.value,
      {
        ...taskPayload,
        id: `task-${Date.now()}`,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  closeModal();
}

function deleteTask(taskId) {
  tasks.value = tasks.value.filter((task) => task.id !== taskId);
  closeModal();
}

function startDrag(taskId) {
  draggedTaskId.value = taskId;
}

function dropTask(columnId) {
  if (!draggedTaskId.value) {
    return;
  }

  tasks.value = tasks.value.map((task) =>
    task.id === draggedTaskId.value
      ? {
          ...task,
          columnId,
        }
      : task,
  );
  draggedTaskId.value = null;
}

function clearFilters() {
  filters.value = {
    search: '',
    priority: 'all',
    assignee: 'all',
    tag: 'all',
    onlyOverdue: false,
  };
}

function resetBoard() {
  const confirmed = window.confirm('Сбросить доску к демо-данным?');

  if (!confirmed) {
    return;
  }

  clearBoardState();
  tasks.value = structuredClone(initialTasks);
  clearFilters();
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :total-tasks="tasks.length" @create-task="openCreateModal" @reset-board="resetBoard" />

    <main>
      <section class="intro-panel" aria-labelledby="page-title">
        <div>
          <span>Vue Kanban Board</span>
          <h1 id="page-title">TaskForge</h1>
        </div>
        <p>
          Управление задачами команды с фильтрами, дедлайнами, чеклистами и сохранением состояния.
        </p>
      </section>

      <StatsPanel :stats="stats" />

      <FilterBar
        :filters="filters"
        :priorities="priorities"
        :assignees="assignees"
        :tags="tags"
        @update:filters="filters = $event"
        @clear="clearFilters"
      />

      <section class="board" aria-label="Kanban доска">
        <BoardColumn
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :columns="columns"
          :tasks="tasksByColumn[column.id]"
          :priority-map="priorityMap"
          :overdue-ids="overdueIds"
          @create-task="openCreateModal"
          @edit-task="openEditModal"
          @drag-start="startDrag"
          @task-drop="dropTask"
        />
      </section>
    </main>

    <TaskModal
      :open="modalOpen"
      :task="selectedTask"
      :columns="columns"
      :priorities="priorities"
      @close="closeModal"
      @save="saveTask"
      @delete="deleteTask"
    />
  </div>
</template>
