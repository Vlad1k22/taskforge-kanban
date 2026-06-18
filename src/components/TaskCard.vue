<script setup>
import { CalendarClock, CheckCircle2, GripVertical, Pencil } from '@lucide/vue';

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
  priorityLabel: {
    type: String,
    required: true,
  },
  isOverdue: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['edit', 'drag-start', 'move']);

function completionPercent() {
  if (!props.task.subtasks.length) {
    return 0;
  }

  const done = props.task.subtasks.filter((item) => item.done).length;
  return Math.round((done / props.task.subtasks.length) * 100);
}
</script>

<template>
  <article
    class="task-card"
    :class="[`task-card--${task.priority}`, { 'task-card--overdue': isOverdue }]"
    draggable="true"
    @dragstart="emit('drag-start', task.id)"
  >
    <div class="task-card__topline">
      <GripVertical :size="18" aria-hidden="true" />
      <span>{{ priorityLabel }}</span>
      <button class="icon-button icon-button--small" type="button" @click="emit('edit', task)" aria-label="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ">
        <Pencil :size="16" aria-hidden="true" />
      </button>
    </div>

    <h3>{{ task.title }}</h3>
    <p>{{ task.description }}</p>

    <ul class="tag-list" :aria-label="`РўРµРіРё Р·Р°РґР°С‡Рё ${task.title}`">
      <li v-for="tag in task.tags" :key="tag">{{ tag }}</li>
    </ul>

    <div class="task-card__meta">
      <span :class="{ danger: isOverdue }">
        <CalendarClock :size="16" aria-hidden="true" />
        {{ task.dueDate || 'Р‘РµР· РґР°С‚С‹' }}
      </span>
      <span>
        <CheckCircle2 :size="16" aria-hidden="true" />
        {{ completionPercent() }}%
      </span>
    </div>

    <div class="task-card__footer">
      <strong>{{ task.assignee }}</strong>
      <span>{{ task.estimate }} С‡</span>
    </div>
  </article>
</template>
