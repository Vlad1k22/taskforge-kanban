<script setup>
defineProps({
  stats: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <section class="stats-panel" aria-label="Сводка по задачам">
    <article>
      <span>Всего</span>
      <strong>{{ stats.total }}</strong>
    </article>
    <article>
      <span>В работе</span>
      <strong>{{ stats.active }}</strong>
    </article>
    <article>
      <span>Просрочено</span>
      <strong>{{ stats.overdue }}</strong>
    </article>
    <article>
      <span>Прогресс</span>
      <strong>{{ stats.progress }}%</strong>
    </article>
  </section>
</template>
