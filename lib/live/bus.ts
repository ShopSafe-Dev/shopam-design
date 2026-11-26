import { ReconnectingSocket, type SocketStatus } from '@/lib/api/ws';
import { WS_NOTIFICATIONS_URL } from '@/lib/api/env';

/**
 * One shared notifications socket for the whole app. Two frame kinds arrive:
 *   {alert, count, id, priority, topic: "notification"}   a message for the person (inbox item)
 *   {type: "event", topic, id}                            "this part changed, refetch it" (no inbox item)
 * Each frame is normalised to a LiveEvent and passed to every subscriber; subscribers filter by topic (see
 * useLiveRefresh). Opens with the first subscriber and closes with the last, so several components never open
 * several sockets.
 */
export interface LiveEvent {
  topic: string;
  id: string | null;
}
type Listener = (ev: LiveEvent) => void;

function toEvent(raw: unknown): LiveEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as { type?: string; topic?: string; id?: string | number | null; alert?: string };
  if (f.type === 'pong') return null;
  if (f.type === 'event' && typeof f.topic === 'string') return { topic: f.topic, id: f.id != null ? String(f.id) : null };
  if (f.alert !== undefined) return { topic: 'notification', id: f.id != null ? String(f.id) : null };
  return null;
}

const listeners = new Set<Listener>();
let sock: ReconnectingSocket | null = null;
let beat: ReturnType<typeof setInterval> | null = null;
let status: SocketStatus = 'idle';

function start() {
  if (sock || !WS_NOTIFICATIONS_URL) return;
  sock = new ReconnectingSocket({
    url: WS_NOTIFICATIONS_URL,
    onStatus: (s) => {
      status = s;
    },
    onMessage: (raw) => {
      const ev = toEvent(raw);
      if (ev) listeners.forEach((l) => l(ev));
    },
  });
  sock.connect().catch(() => {});
  // The server drops idle sockets from their group: ping every 40 s.
  beat = setInterval(() => sock?.send({ type: 'ping' }), 40_000);
}

function stop() {
  if (beat) clearInterval(beat);
  beat = null;
  sock?.close();
  sock = null;
  status = 'idle';
}

export function subscribePush(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** True while the push socket is connected, so pollers can slow down. */
export const isPushOpen = (): boolean => status === 'open';
