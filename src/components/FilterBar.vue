<script setup>
import { Search, X } from '@lucide/vue';

defineProps({
  filters: {
    type: Object,
    required: true,
  },
  priorities: {
    type: Array,
    required: true,
  },
  assignees: {
    type: Array,
    required: true,
  },
  tags: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['update:filters', 'clear']);
</script>

<template>
  <section class="filter-bar" aria-label="Фильтры задач">
    <label class="search-field">
      <Search :size="19" aria-hidden="true" />
      <input
        :value="filters.search"
        type="search"
        placeholder="Поиск"
        @input="emit('update:filters', { ...filters, search: $event.target.value })"
      />
    </label>

    <label>
      <span>Приоритет</span>
      <select :value="filters.priority" @change="emit('update:filters', { ...filters, priority: $event.target.value })">
        <option value="all">Все</option>
        <option v-for="priority in priorities" :key="priority.value" :value="priority.value">
          {{ priority.label }}
        </option>
      </select>
    </label>

    <label>
      <span>Исполнитель</span>
      <select :value="filters.assignee" @change="emit('update:filters', { ...filters, assignee: $event.target.value })">
        <option value="all">Все</option>
        <option v-for="assignee in assignees" :key="assignee" :value="assignee">
          {{ assignee }}
        </option>
      </select>
    </label>

    <label>
      <span>Тег</span>
      <select :value="filters.tag" @change="emit('update:filters', { ...filters, tag: $event.target.value })">
        <option value="all">Все</option>
        <option v-for="tag in tags" :key="tag" :value="tag">
          {{ tag }}
        </option>
      </select>
    </label>

    <label class="toggle-field">
      <input
        :checked="filters.onlyOverdue"
        type="checkbox"
        @change="emit('update:filters', { ...filters, onlyOverdue: $event.target.checked })"
      />
      <span>Просроченные</span>
    </label>

    <button class="icon-button" type="button" @click="emit('clear')" aria-label="Очистить фильтры" title="Очистить фильтры">
      <X :size="20" aria-hidden="true" />
    </button>
  </section>
</template>
