<script setup>
import { computed, reactive, watch } from 'vue';
import { Save, Trash2, X } from '@lucide/vue';

const props = defineProps({
  task: {
    type: Object,
    default: null,
  },
  columns: {
    type: Array,
    required: true,
  },
  priorities: {
    type: Array,
    required: true,
  },
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'save', 'delete']);

const form = reactive({
  id: '',
  title: '',
  description: '',
  columnId: 'backlog',
  priority: 'medium',
  assignee: '',
  dueDate: '',
  estimate: 1,
  tagsText: '',
  subtasksText: '',
});

const title = computed(() => (props.task?.id ? 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ' : 'РќРѕРІР°СЏ Р·Р°РґР°С‡Р°'));
const canSave = computed(() => form.title.trim().length >= 3 && form.assignee.trim().length >= 2);

watch(
  () => props.task,
  (task) => {
    form.id = task?.id || '';
    form.title = task?.title || '';
    form.description = task?.description || '';
    form.columnId = task?.columnId || 'backlog';
    form.priority = task?.priority || 'medium';
    form.assignee = task?.assignee || '';
    form.dueDate = task?.dueDate || '';
    form.estimate = task?.estimate || 1;
    form.tagsText = task?.tags?.join(', ') || '';
    form.subtasksText = task?.subtasks?.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.title}`).join('\n') || '';
  },
  { immediate: true },
);

function parseTags() {
  return form.tagsText
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function parseSubtasks() {
  return form.subtasksText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: props.task?.subtasks?.[index]?.id || `sub-${Date.now()}-${index}`,
      title: line.replace(/^\[(x| )\]\s*/i, ''),
      done: /^\[x\]/i.test(line),
    }));
}

function submit() {
  if (!canSave.value) {
    return;
  }

  emit('save', {
    id: form.id,
    title: form.title.trim(),
    description: form.description.trim(),
    columnId: form.columnId,
    priority: form.priority,
    assignee: form.assignee.trim(),
    dueDate: form.dueDate,
    estimate: Number(form.estimate) || 1,
    tags: parseTags(),
    subtasks: parseSubtasks(),
  });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <section class="task-modal" role="dialog" aria-modal="true" :aria-label="title">
        <header class="task-modal__header">
          <h2>{{ title }}</h2>
          <button class="icon-button" type="button" @click="emit('close')" aria-label="Р—Р°РєСЂС‹С‚СЊ">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <form class="task-form" @submit.prevent="submit">
          <label>
            <span>РќР°Р·РІР°РЅРёРµ</span>
            <input v-model="form.title" type="text" placeholder="РќР°РїСЂРёРјРµСЂ: РїСЂРѕРІРµСЂРёС‚СЊ Р°РґР°РїС‚РёРІ" />
          </label>

          <label>
            <span>РћРїРёСЃР°РЅРёРµ</span>
            <textarea v-model="form.description" rows="4" placeholder="РљРѕСЂРѕС‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ Р·Р°РґР°С‡Рё"></textarea>
          </label>

          <div class="form-grid">
            <label>
              <span>РљРѕР»РѕРЅРєР°</span>
              <select v-model="form.columnId">
                <option v-for="column in columns" :key="column.id" :value="column.id">
                  {{ column.title }}
                </option>
              </select>
            </label>

            <label>
              <span>РџСЂРёРѕСЂРёС‚РµС‚</span>
              <select v-model="form.priority">
                <option v-for="priority in priorities" :key="priority.value" :value="priority.value">
                  {{ priority.label }}
                </option>
              </select>
            </label>

            <label>
              <span>РСЃРїРѕР»РЅРёС‚РµР»СЊ</span>
              <input v-model="form.assignee" type="text" placeholder="РРјСЏ" />
            </label>

            <label>
              <span>Р”РµРґР»Р°Р№РЅ</span>
              <input v-model="form.dueDate" type="date" />
            </label>

            <label>
              <span>РћС†РµРЅРєР°, С‡Р°СЃС‹</span>
              <input v-model.number="form.estimate" min="1" max="40" type="number" />
            </label>

            <label>
              <span>РўРµРіРё</span>
              <input v-model="form.tagsText" type="text" placeholder="vue, css, qa" />
            </label>
          </div>

          <label>
            <span>Р§РµРєР»РёСЃС‚</span>
            <textarea v-model="form.subtasksText" rows="4" placeholder="[ ] РџСѓРЅРєС‚ Р·Р°РґР°С‡Рё"></textarea>
          </label>

          <footer class="task-modal__actions">
            <button v-if="task?.id" class="button button--danger" type="button" @click="emit('delete', task.id)">
              <Trash2 :size="18" aria-hidden="true" />
              РЈРґР°Р»РёС‚СЊ
            </button>
            <button class="button button--primary" type="submit" :disabled="!canSave">
              <Save :size="18" aria-hidden="true" />
              РЎРѕС…СЂР°РЅРёС‚СЊ
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
