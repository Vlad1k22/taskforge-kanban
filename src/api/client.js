export const remoteEnabled = import.meta.env.VITE_BACKEND_ENABLED === 'true';

export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options, credentials: 'same-origin',
    headers: { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-TaskForge-Request': '1', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Не удалось выполнить запрос');
    error.status = response.status;
    throw error;
  }
  return result;
}

export function socketUrl(boardId) {
  const url = new URL(`/api/boards/${boardId}/events`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
