import { WebSocket } from 'ws';

interface Subscription { socket: WebSocket; boardId: string; sessionId: string; alive: boolean }

export class RealtimeHub {
  private readonly subscriptions = new Set<Subscription>();
  private readonly heartbeat = setInterval(() => {
    for (const sub of this.subscriptions) {
      if (!sub.alive) sub.socket.terminate();
      else { sub.alive = false; sub.socket.ping(); }
    }
  }, 30_000).unref();

  subscribe(socket: WebSocket, boardId: string, sessionId: string, expiresAt: number) {
    const sub: Subscription = { socket, boardId, sessionId, alive: true };
    this.subscriptions.add(sub);
    const expiry = setTimeout(() => socket.close(1008, 'Session expired'), Math.max(0, expiresAt - Date.now())).unref();
    socket.on('pong', () => { sub.alive = true; });
    socket.on('error', () => socket.terminate());
    socket.on('close', () => { clearTimeout(expiry); this.subscriptions.delete(sub); });
  }

  publish(boardId: string) {
    for (const sub of this.subscriptions) {
      if (sub.boardId === boardId && sub.socket.readyState === WebSocket.OPEN) {
        sub.socket.send(JSON.stringify({ type: 'board.changed', boardId }));
      }
    }
  }

  closeSession(sessionId: string) {
    for (const sub of this.subscriptions) {
      if (sub.sessionId === sessionId) sub.socket.close(1008, 'Signed out');
    }
  }

  close() {
    clearInterval(this.heartbeat);
    for (const sub of this.subscriptions) sub.socket.terminate();
    this.subscriptions.clear();
  }
}
