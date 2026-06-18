<script setup>
import { Plus } from '@lucide/vue';
import TaskCard from './TaskCard.vue';

defineProps({
  column: {
    type: Object,
    required: true,
  },
  tasks: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
  priorityMap: {
    type: Object,
    required: true,
  },
  overdueIds: {
    type: Set,
    required: true,
  },
});

const emit = defineEmits(['create-task', 'edit-task', 'drag-start', 'task-drop']);
</script>

<template>
  <section
    class="board-column"
    :style="{ '--column-accent': column.accent }"
    @dragover.prevent
    @drop="emit('task-drop', column.id)"
  >
    <header class="board-column__header">
      <div>
        <h2>{{ column.title }}</h2>
        <span>{{ tasks.length }}</span>
      </div>
      <button class="icon-button icon-button--small" type="button" @click="emit('create-task', column.id)" aria-label="Р”РѕР±Р°РІРёС‚СЊ Р·Р°РґР°С‡Сѓ">
        <Plus :size="17" aria-hidden="true" />
      </button>
    </header>

    <div class="board-column__body">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :columns="columns"
        :priority-label="priorityMap[task.priority]"
        :is-overdue="overdueIds.has(task.id)"
        @edit="emit('edit-task', $event)"
        @drag-start="emit('drag-start', $event)"
      />

      <div v-if="tasks.length === 0" class="empty-column">
        РќРµС‚ Р·Р°РґР°С‡
      </div>
    </div>
  </section>
</template>
