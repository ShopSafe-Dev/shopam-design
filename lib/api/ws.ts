import { accountsApi } from './endpoints/accounts';

/**
 * WebSocket client for chat / real-time sync.
 *
 * Auth flow (from GET /api/accounts/ws-ticket in the API spec):
 *   1. Call ws-ticket over the normal HTTP proxy. Backend returns a random,
 *      single-use ticket valid for 30 seconds.
 *   2. Open the socket with `?session_id=<ticket>`.
 *   Because tickets are single-use, EVERY (re)connect fetches a fresh one.
 *
 * The WS route itself is NOT in the OpenAPI spec, so it comes from the env:
 *   NEXT_PUBLIC_WS_URL=wss://api.shopsafeng.com/<ws-path>   (no query string)
 * Sending messages: use REST (postsApi.messagesCreate). The backend pushes the
 * saved message back over this socket ("Integrated with WebSockets").
 */

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SocketOptions<T = unknown> {
  /** Full ws(s):// URL without query. Defaults to NEXT_PUBLIC_WS_URL. */
  url?: string;
  onMessage?: (data: T, raw: MessageEvent) => void;
  onStatus?: (status: SocketStatus) => void;
  /** Max backoff between reconnects (ms). Default 30000. */
  maxBackoffMs?: number;
}

/** Ticket response shape is untyped in the spec: accept a bare string or a common key. */
function extractTicket(data: unknown): string {
  if (typeof data === 'string' && data) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of ['ticket', 'session_id', 'token']) {
      if (typeof d[k] === 'string' && d[k]) return d[k] as string;
    }
  }
  throw new Error('ws-ticket response had no ticket field');
}

export class ReconnectingSocket<T = unknown> {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private offline = () => {};
  status: SocketStatus = 'idle';

  constructor(private opts: SocketOptions<T> = {}) {}

  private setStatus(s: SocketStatus) {
    this.status = s;
    this.opts.onStatus?.(s);
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined') return;
    const base = this.opts.url ?? process.env.NEXT_PUBLIC_WS_URL;
    if (!base) throw new Error('NEXT_PUBLIC_WS_URL is not set');
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.manualClose = false;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let ticket: string;
    try {
      ticket = extractTicket(await accountsApi.wsTicketRetrieve());
    } catch {
      this.scheduleReconnect(); // not signed in yet or network blip
      return;
    }

    const sep = base.includes('?') ? '&' : '?';
    const ws = new WebSocket(`${base}${sep}session_id=${encodeURIComponent(ticket)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
    };
    ws.onmessage = (ev) => {
      let data: unknown = ev.data;
      if (typeof ev.data === 'string') {
        try {
          data = JSON.parse(ev.data);
        } catch {
          /* keep raw text */
        }
      }
      this.opts.onMessage?.(data as T, ev);
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.manualClose) this.setStatus('closed');
      else this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();

    // Reconnect promptly when the network returns.
    const onOnline = () => {
      if (!this.manualClose && this.ws === null) {
        if (this.timer) clearTimeout(this.timer);
        void this.connect();
      }
    };
    window.addEventListener('online', onOnline);
    this.offline = () => window.removeEventListener('online', onOnline);
  }

  private scheduleReconnect() {
    if (this.manualClose) return;
    this.setStatus('reconnecting');
    const max = this.opts.maxBackoffMs ?? 30000;
    const delay = Math.min(max, 1000 * 2 ** this.attempt) * (0.5 + Math.random() / 2);
    this.attempt += 1;
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  /** Send a JSON-serialisable payload. Returns false if the socket is not open. */
  send(payload: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return true;
  }

  close() {
    this.manualClose = true;
    if (this.timer) clearTimeout(this.timer);
    this.offline();
    this.ws?.close();
    this.ws = null;
    this.setStatus('closed');
  }
}
