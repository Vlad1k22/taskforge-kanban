<script setup>
defineProps({
  stats: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <section class="stats-panel" aria-label="РЎРІРѕРґРєР° РїРѕ Р·Р°РґР°С‡Р°Рј">
    <article>
      <span>Р’СЃРµРіРѕ</span>
      <strong>{{ stats.total }}</strong>
    </article>
    <article>
      <span>Р’ СЂР°Р±РѕС‚Рµ</span>
      <strong>{{ stats.active }}</strong>
    </article>
    <article>
      <span>РџСЂРѕСЃСЂРѕС‡РµРЅРѕ</span>
      <strong>{{ stats.overdue }}</strong>
    </article>
    <article>
      <span>РџСЂРѕРіСЂРµСЃСЃ</span>
      <strong>{{ stats.progress }}%</strong>
    </article>
  </section>
</template>
