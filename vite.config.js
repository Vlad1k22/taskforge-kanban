import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/taskforge-kanban/',
  plugins: [vue()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3001', ws: true } } },
});
