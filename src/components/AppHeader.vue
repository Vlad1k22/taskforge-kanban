<script setup>
import { ExternalLink, LogOut, Plus, RotateCcw } from '@lucide/vue';

defineProps({
  user: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  busy: Boolean,
  totalTasks: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['create-task', 'reset-board', 'logout']);
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
      <span v-if="user" class="session-user">{{ user.displayName }}</span>
      <button v-if="user" class="icon-button" type="button" title="Выйти" aria-label="Выйти" :disabled="busy" @click="emit('logout')"><LogOut :size="20" /></button>
      <a
        class="icon-button"
        href="https://github.com/Vlad1k22/taskforge-kanban"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <ExternalLink :size="20" aria-hidden="true" />
      </a>
      <button v-if="editable" class="icon-button" type="button" :disabled="busy" @click="emit('reset-board')" aria-label="Сбросить доску" title="Сбросить доску">
        <RotateCcw :size="20" aria-hidden="true" />
      </button>
      <button v-if="editable" class="button button--primary" type="button" :disabled="busy" @click="emit('create-task')">
        <Plus :size="19" aria-hidden="true" />
        Новая задача
      </button>
    </div>
  </header>
</template>
