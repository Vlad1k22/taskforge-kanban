<script setup>
import { reactive, ref } from 'vue';
import { LogIn } from '@lucide/vue';
defineProps({ busy: Boolean, error: { type: String, default: '' } });
const emit = defineEmits(['submit']);
const mode = ref('login');
const form = reactive({ email: '', password: '', displayName: '' });
function submit() {
  const body = { email: form.email.trim(), password: form.password };
  if (mode.value === 'register') body.displayName = form.displayName.trim();
  emit('submit', mode.value, body);
}
</script>
<template>
  <section class="auth-panel" aria-label="Аккаунт TaskForge">
    <h1>TaskForge</h1>
    <div class="auth-tabs" role="tablist" aria-label="Доступ к аккаунту">
      <button role="tab" type="button" :aria-selected="mode === 'login'" @click="mode = 'login'">Вход</button>
      <button role="tab" type="button" :aria-selected="mode === 'register'" @click="mode = 'register'">Регистрация</button>
    </div>
    <form class="auth-form" @submit.prevent="submit">
      <label v-if="mode === 'register'">Имя<input v-model="form.displayName" autocomplete="name" minlength="2" maxlength="80" required /></label>
      <label>Email<input v-model="form.email" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>Пароль<input v-model="form.password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" minlength="10" maxlength="128" required /></label>
      <p v-if="error" role="alert" class="danger">{{ error }}</p>
      <button class="button button--primary" type="submit" :disabled="busy"><LogIn :size="18" aria-hidden="true" />{{ mode === 'login' ? 'Войти' : 'Создать аккаунт' }}</button>
    </form>
  </section>
</template>
