<script setup>
import { ExternalLink, Plus, RotateCcw } from '@lucide/vue';

defineProps({
  totalTasks: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['create-task', 'reset-board']);
</script>

<template>
  <header class="app-header">
    <a class="brand" href="#" aria-label="TaskForge Kanban">
      <span class="brand__mark">TF</span>
      <span>
        <strong>TaskForge</strong>
        <small>{{ totalTasks }} задач</small>
      </span>
    </a>

    <div class="header-actions">
      <a
        class="icon-button"
        href="https://github.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <ExternalLink :size="20" aria-hidden="true" />
      </a>
      <button class="icon-button" type="button" @click="emit('reset-board')" aria-label="Сбросить доску" title="Сбросить доску">
        <RotateCcw :size="20" aria-hidden="true" />
      </button>
      <button class="button button--primary" type="button" @click="emit('create-task')">
        <Plus :size="19" aria-hidden="true" />
        Новая задача
      </button>
    </div>
  </header>
</template>
