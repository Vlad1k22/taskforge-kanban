const STORAGE_KEY = 'taskforge-kanban-state';

export function loadBoardState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBoardState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearBoardState() {
  localStorage.removeItem(STORAGE_KEY);
}
