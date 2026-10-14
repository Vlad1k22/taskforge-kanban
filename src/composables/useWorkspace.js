import { onMounted, onUnmounted, ref, watch } from 'vue';
import { initialTasks } from '../data/initialBoard';
import { loadBoardState, saveBoardState } from '../utils/storage';
import { remoteEnabled, request, socketUrl } from '../api/client';

export function useWorkspace() {
  const tasks = ref(remoteEnabled ? [] : (loadBoardState()?.tasks || structuredClone(initialTasks)));
  const user = ref(null);
  const boards = ref([]);
  const boardId = ref('');
  const loading = ref(remoteEnabled);
  const mutating = ref(false);
  const error = ref('');
  const realtimeStatus = ref('disconnected');
  let socket;
  let reconnectTimer;
  let requestId = 0;
  let reconnectDelay = 500;
  watch(tasks, (value) => { if (!remoteEnabled) saveBoardState({ tasks: value }); }, { deep: true });

  function stopRealtime() {
    clearTimeout(reconnectTimer);
    if (socket) { socket.onclose = null; socket.close(); socket = null; }
    realtimeStatus.value = 'disconnected';
  }
  function clearSession() {
    stopRealtime(); requestId += 1; user.value = null; boards.value = []; boardId.value = ''; tasks.value = [];
  }
  function handleError(cause) {
    error.value = cause.message || 'Не удалось связаться с сервером';
    if (cause.status === 401) clearSession();
  }
  async function loadTasks() {
    const id = ++requestId;
    loading.value = true;
    try {
      const result = await request(`/boards/${boardId.value}/tasks`);
      if (id === requestId) { tasks.value = result.tasks; error.value = ''; }
    } catch (cause) { if (id === requestId) handleError(cause); }
    finally { if (id === requestId || !user.value) loading.value = false; }
  }
  function connectRealtime(id) {
    if (!user.value || id !== boardId.value || !navigator.onLine) return;
    realtimeStatus.value = 'connecting';
    socket = new WebSocket(socketUrl(id));
    socket.onopen = () => { reconnectDelay = 500; realtimeStatus.value = 'connected'; loadTasks(); };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'board.changed' && message.boardId === boardId.value) loadTasks();
      } catch { /* Ignore messages outside the event contract. */ }
    };
    socket.onclose = (event) => {
      if (event.code === 1008) { clearSession(); error.value = 'Сессия завершена. Войдите снова'; return; }
      realtimeStatus.value = 'disconnected';
      reconnectTimer = setTimeout(() => connectRealtime(id), reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
    };
  }
  async function selectBoard(id) {
    stopRealtime(); boardId.value = id; tasks.value = [];
    try { localStorage.setItem(`taskforge-active-board:${user.value.id}`, id); } catch { /* Preferences are optional. */ }
    await loadTasks();
    if (user.value && boardId.value === id) connectRealtime(id);
  }
  async function reload() {
    loading.value = true;
    try {
      const result = await request('/boards');
      boards.value = result.boards;
      let selectedId = boardId.value;
      try { selectedId ||= localStorage.getItem(`taskforge-active-board:${user.value.id}`); } catch { /* Preferences are optional. */ }
      const selected = result.boards.find((board) => board.id === selectedId) || result.boards[0];
      if (selected) await selectBoard(selected.id);
    } catch (cause) { handleError(cause); }
    finally { loading.value = false; }
  }
  async function mutate(action) {
    mutating.value = true; error.value = '';
    try { await action(); return true; }
    catch (cause) { handleError(cause); return false; }
    finally { mutating.value = false; }
  }
  const authenticate = (mode, body) => mutate(async () => {
    const result = await request(`/auth/${mode}`, { method: 'POST', body });
    user.value = result.user; await reload();
  });
  const logout = () => mutate(async () => { await request('/auth/logout', { method: 'POST' }); clearSession(); });
  const createBoard = (name) => mutate(async () => {
    const { board } = await request('/boards', { method: 'POST', body: { name } });
    boards.value.push(board); await selectBoard(board.id);
  });
  const saveTask = (payload) => mutate(async () => {
    const { id, createdAt: _createdAt, ...body } = payload;
    if (remoteEnabled) {
      await request(`/boards/${boardId.value}/tasks${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body });
      await loadTasks();
    } else if (id) tasks.value = tasks.value.map((task) => task.id === id ? { ...task, ...body } : task);
    else tasks.value.push({ ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  });
  const deleteTask = (id) => mutate(async () => {
    if (remoteEnabled) { await request(`/boards/${boardId.value}/tasks/${id}`, { method: 'DELETE' }); await loadTasks(); }
    else tasks.value = tasks.value.filter((task) => task.id !== id);
  });
  const moveTask = (id, columnId) => mutate(async () => {
    if (remoteEnabled) { await request(`/boards/${boardId.value}/tasks/${id}`, { method: 'PATCH', body: { columnId } }); await loadTasks(); }
    else tasks.value = tasks.value.map((task) => task.id === id ? { ...task, columnId } : task);
  });
  const reset = () => mutate(async () => {
    if (remoteEnabled) { await request(`/boards/${boardId.value}/reset`, { method: 'POST' }); await loadTasks(); }
    else tasks.value = structuredClone(initialTasks);
  });
  function resumeRealtime() {
    stopRealtime();
    if (user.value && boardId.value) connectRealtime(boardId.value);
  }
  onMounted(async () => {
    if (!remoteEnabled) return;
    window.addEventListener('offline', stopRealtime);
    window.addEventListener('online', resumeRealtime);
    try { const result = await request('/auth/me'); user.value = result.user; await reload(); }
    catch (cause) { if (cause.status !== 401) handleError(cause); }
    finally { loading.value = false; }
  });
  onUnmounted(() => {
    stopRealtime();
    window.removeEventListener('offline', stopRealtime);
    window.removeEventListener('online', resumeRealtime);
  });
  return { tasks, user, boards, boardId, loading, mutating, error, realtimeStatus,
    authenticate, logout, createBoard, selectBoard, reload, saveTask, deleteTask, moveTask, reset };
}
