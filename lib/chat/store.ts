import { ReconnectingSocket, type SocketStatus } from '@/lib/api/ws';
import { chatApi, type ConversationRow } from './api';
import { fromApi, MAX_LEN, parseFrame, streamKey, type ChatMsg } from './types';

/**
 * One chat store for the whole tab, shared by the customer and vendor UIs.
 *  - ONE WebSocket per tab (ws/chat/ carries every conversation of the user), reference counted by start().
 *  - One thread per ORDER (key "order:<id>") plus one general thread per person ("user:<id>").
 *  - A message is mine iff sender === meId. Roles are never used to decide sides.
 *  - Unread and read receipts come from the server (Message.is_read, mark_thread_read).
 *  - When the socket is not open, visible views are refetched every few seconds instead.
 */
export type Link = SocketStatus | 'unavailable';

export interface ThreadRef {
  order?: string | null;
  other?: string | null;
}

export interface ThreadState {
  key: string;
  order: string | null;
  /** The other person's user id ('' for an order thread we have not seen a message of yet). */
  other: string;
  orderRef: string | null;
  orderStatus: string | null;
  name: string;
  messages: ChatMsg[]; // ascending by time
  full: boolean; // the thread endpoint has been loaded (not just the inbox snippet)
  loading: boolean;
  loadingOlder: boolean;
  error: string;
  hasMore: boolean;
  cursor: string | null;
  unread: number;
}

export interface ChatState {
  meId: string | null;
  link: Link;
  inboxLoading: boolean;
  inboxLoaded: boolean;
  inboxError: string;
  threads: Record<string, ThreadState>;
  active: string | null;
}

const INITIAL: ChatState = { meId: null, link: 'idle', inboxLoading: false, inboxLoaded: false, inboxError: '', threads: {}, active: null };

const emptyThread = (key: string, order: string | null, other: string): ThreadState => ({
  key,
  order,
  other,
  orderRef: order ? order.slice(0, 8).toUpperCase() : null,
  orderStatus: null,
  name: '',
  messages: [],
  full: false,
  loading: false,
  loadingOlder: false,
  error: '',
  hasMore: false,
  cursor: null,
  unread: 0,
});

let state: ChatState = INITIAL;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(patch: Partial<ChatState>) {
  state = { ...state, ...patch };
  emit();
}
function patchThread(key: string, base: () => ThreadState, fn: (t: ThreadState) => ThreadState) {
  const cur = state.threads[key] ?? base();
  set({ threads: { ...state.threads, [key]: fn(cur) } });
}

/* ───────────── helpers ───────────── */
export const keyOf = (ref: ThreadRef): string => streamKey(ref.order ?? null, ref.other ?? null);
const ts = (m: ChatMsg) => new Date(m.created_at).getTime() || 0;
const sortAsc = (a: ChatMsg, b: ChatMsg) => ts(a) - ts(b) || a.id.localeCompare(b.id);
const otherOf = (m: ChatMsg, me: string) => (m.sender === me ? m.recipient : m.sender);
const nameOf = (m: ChatMsg, me: string) => (m.sender === me ? m.recipient_name : m.sender_name) || '';
const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

function upsert(list: ChatMsg[], msg: ChatMsg, me: string): ChatMsg[] {
  let next = list;
  if (msg.sender === me && !msg.local) {
    // The server copy of my own message replaces its optimistic twin if the socket echo beat the REST reply.
    next = next.filter((m) => !(m.local === 'sending' && m.content === msg.content));
  }
  const i = next.findIndex((m) => m.id === msg.id);
  if (i >= 0) {
    const copy = next.slice();
    copy[i] = { ...copy[i], ...msg };
    return copy;
  }
  return [...next, msg].sort(sortAsc);
}

const baseFor = (key: string, order: string | null, other: string) => () => emptyThread(key, order, other);

function ingest(msg: ChatMsg, edited: boolean) {
  const me = state.meId;
  if (!me || (msg.sender !== me && msg.recipient !== me)) return;
  const other = otherOf(msg, me);
  const key = streamKey(msg.order, other);
  const isNew = !state.threads[key]?.messages.some((m) => m.id === msg.id);
  patchThread(key, baseFor(key, msg.order, other), (t) => ({
    ...t,
    other: t.other || other,
    name: t.name || nameOf(msg, me),
    messages: upsert(t.messages, msg, me),
    unread: isNew && !edited && msg.sender !== me && !(state.active === key && visible()) ? t.unread + 1 : t.unread,
  }));
  if (msg.sender !== me && isNew && state.active === key && visible()) chat.markRead(key);
}

const cursorOf = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url, 'http://x.invalid').searchParams.get('cursor');
  } catch {
    return null;
  }
};

/** Newest-first (what the API does): `next` is older. If it ever returns oldest-first, follow to the end (capped). */
async function readPages(first: (cursor?: string) => Promise<{ next?: string | null; results: import('./types').ApiMsg[] }>) {
  const page = await first();
  let items = page.results;
  let next = cursorOf(page.next);
  const t = (m: { created_at?: string }) => new Date(m.created_at ?? 0).getTime();
  const descending = items.length < 2 || t(items[0]) >= t(items[items.length - 1]);
  if (!descending) {
    let pages = 1;
    while (next && pages < 25) {
      const p = await first(next);
      items = items.concat(p.results);
      next = cursorOf(p.next);
      pages += 1;
    }
    return { items, next: null as string | null };
  }
  return { items, next };
}

/* ───────────── runtime (socket + polling) ───────────── */
let refs = 0;
let sock: ReconnectingSocket | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let beat: ReturnType<typeof setInterval> | null = null;
let soon: ReturnType<typeof setTimeout> | null = null;
let wasOpen = false;
let tick = 0;
let onVisible: (() => void) | null = null;

function refreshSoon() {
  if (soon) clearTimeout(soon);
  soon = setTimeout(() => void chat.refresh(), 400);
}

function connect() {
  if (sock) return;
  sock = new ReconnectingSocket({
    onStatus: (s) => {
      set({ link: s });
      if (s === 'open') {
        if (!wasOpen && state.inboxLoaded) void chat.refresh(); // catch up on anything missed while down
        wasOpen = true;
      } else wasOpen = false;
    },
    onMessage: (raw) => {
      const frame = parseFrame(raw);
      const me = state.meId;
      if (!frame) return refreshSoon();
      if (frame.kind === 'message') ingest(frame.msg, frame.edited);
      else if (frame.kind === 'deleted') {
        const threads: Record<string, ThreadState> = {};
        for (const [k, t] of Object.entries(state.threads)) {
          threads[k] = t.messages.some((m) => m.id === frame.id) ? { ...t, messages: t.messages.filter((m) => m.id !== frame.id) } : t;
        }
        set({ threads });
      } else if (frame.kind === 'read' && me && frame.by !== me) {
        const key = streamKey(frame.order, frame.by);
        const t = state.threads[key];
        if (t) patchThread(key, baseFor(key, frame.order, frame.by), (x) => ({ ...x, messages: x.messages.map((m) => (m.sender === me ? { ...m, is_read: true } : m)) }));
      }
    },
  });
  sock.connect().catch(() => set({ link: 'unavailable' }));
}

function teardown() {
  sock?.close();
  sock = null;
  for (const t of [poll, beat]) if (t) clearInterval(t);
  poll = beat = null;
  if (soon) clearTimeout(soon);
  soon = null;
  if (onVisible && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
  onVisible = null;
  wasOpen = false;
  tick = 0;
  state = INITIAL;
  emit();
}

/* ───────────── public API ───────────── */
export const chat = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getState: () => state,
  getServerState: () => INITIAL,

  /** Start the shared runtime for this signed-in user. Returns a stop function. */
  start(meId: string): () => void {
    if (typeof window === 'undefined') return () => {};
    if (state.meId && state.meId !== meId) {
      refs = 0;
      teardown();
    }
    refs += 1;
    if (refs === 1 || state.meId !== meId) {
      set({ meId, link: 'connecting' });
      connect();
      poll = setInterval(() => {
        if (!visible() || state.link === 'open') return;
        tick += 1;
        void chat.refresh({ inbox: tick % 3 === 0 });
      }, 8000);
      // The server drops idle sockets from their group: ping every 40 s.
      beat = setInterval(() => sock?.send({ type: 'ping' }), 40_000);
      onVisible = () => {
        if (visible() && state.link !== 'open') void chat.refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      void chat.loadInbox();
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      refs = Math.max(0, refs - 1);
      if (refs === 0) teardown();
    };
  },

  /** One row per order chat (plus general chats), with last message and unread from the server. */
  async loadInbox(): Promise<void> {
    const me = state.meId;
    if (!me || state.inboxLoading) return;
    set({ inboxLoading: true, inboxError: '' });
    try {
      const rows: ConversationRow[] = await (await import('./api')).chatApi.conversations();
      if (state.meId !== me) return;
      const threads = { ...state.threads };
      for (const r of rows) {
        const key = streamKey(r.order, r.other_user);
        const t = threads[key] ?? emptyThread(key, r.order, r.other_user);
        threads[key] = {
          ...t,
          other: r.other_user,
          name: r.other_name || t.name,
          orderRef: r.order_ref ?? t.orderRef,
          orderStatus: r.order_status ?? t.orderStatus,
          unread: state.active === key && visible() ? 0 : r.unread,
          messages: upsert(t.messages, fromApi(r.last_message), me),
        };
      }
      set({ threads, inboxLoaded: true, inboxLoading: false });
    } catch {
      if (state.meId === me) set({ inboxLoading: false, inboxLoaded: true, inboxError: 'Could not load your messages.' });
    }
  },

  /** Full history of one chat (first page; older pages on demand). */
  async loadThread(ref: ThreadRef, opts: { silent?: boolean } = {}): Promise<void> {
    const me = state.meId;
    const key = keyOf(ref);
    if (!me || (!ref.order && !ref.other)) return;
    const order = ref.order ?? null;
    const base = baseFor(key, order, ref.other ?? '');
    if (state.threads[key]?.loading) return;
    if (!opts.silent) patchThread(key, base, (t) => ({ ...t, loading: true, error: '' }));
    try {
      const { items, next } = await readPages((cursor) => chatApi.thread({ ...(order ? { order } : { user_id: ref.other ?? '' }), ...(cursor ? { cursor } : {}) }));
      if (state.meId !== me) return;
      patchThread(key, base, (t) => {
        let messages = t.messages;
        let name = t.name;
        let other = t.other;
        for (const raw of items) {
          const m = fromApi(raw);
          messages = upsert(messages, m, me);
          name = name || nameOf(m, me);
          other = other || otherOf(m, me);
        }
        return {
          ...t,
          messages,
          name,
          other,
          loading: false,
          full: true,
          error: '',
          hasMore: t.full ? t.hasMore : next !== null,
          cursor: t.full ? t.cursor : next,
        };
      });
    } catch {
      patchThread(key, base, (t) => ({ ...t, loading: false, error: t.messages.length ? '' : 'Could not load this conversation.' }));
    }
  },

  async loadOlder(key: string): Promise<void> {
    const me = state.meId;
    const t = state.threads[key];
    if (!me || !t || !t.hasMore || !t.cursor || t.loadingOlder) return;
    patchThread(key, baseFor(key, t.order, t.other), (x) => ({ ...x, loadingOlder: true }));
    try {
      const page = await chatApi.thread({ ...(t.order ? { order: t.order } : { user_id: t.other }), cursor: t.cursor });
      if (state.meId !== me) return;
      patchThread(key, baseFor(key, t.order, t.other), (x) => {
        let messages = x.messages;
        for (const raw of page.results) messages = upsert(messages, fromApi(raw), me);
        const next = cursorOf(page.next);
        return { ...x, messages, loadingOlder: false, cursor: next, hasMore: next !== null };
      });
    } catch {
      patchThread(key, baseFor(key, t.order, t.other), (x) => ({ ...x, loadingOlder: false }));
    }
  },

  /** Refetch what is on screen (active thread) and optionally the inbox. */
  async refresh(opts: { inbox?: boolean } = { inbox: true }): Promise<void> {
    const jobs: Promise<void>[] = [];
    const a = state.active ? state.threads[state.active] : null;
    if (a) jobs.push(chat.loadThread({ order: a.order, other: a.other }, { silent: true }));
    if (opts.inbox !== false) jobs.push(chat.loadInbox());
    await Promise.all(jobs);
  },

  setActive(key: string | null) {
    set({ active: key });
    if (key) chat.markRead(key);
  },

  /** Tell the server (and the other person's screen) that everything here has been seen. */
  markRead(key: string) {
    const t = state.threads[key];
    if (!state.meId || !t) return;
    const me = state.meId;
    const hasUnread = t.unread > 0 || t.messages.some((m) => m.sender !== me && !m.is_read && !m.local);
    if (!hasUnread) return;
    patchThread(key, baseFor(key, t.order, t.other), (x) => ({
      ...x,
      unread: 0,
      messages: x.messages.map((m) => (m.sender !== me ? { ...m, is_read: true } : m)),
    }));
    void chatApi.markRead({ order: t.order, user_id: t.other }).catch(() => {});
  },

  async send(ref: ThreadRef, text: string): Promise<void> {
    const me = state.meId;
    const content = text.trim();
    const key = keyOf(ref);
    if (!me || !content || content.length > MAX_LEN || (!ref.order && !ref.other)) return;
    const order = ref.order ?? null;
    const base = baseFor(key, order, ref.other ?? '');
    const tempId = `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const temp: ChatMsg = {
      id: tempId, sender: me, recipient: ref.other ?? '', order, content,
      created_at: new Date().toISOString(), is_read: false, is_system: false, local: 'sending',
    };
    patchThread(key, base, (t) => ({ ...t, messages: [...t.messages, temp].sort(sortAsc) }));
    try {
      // For an order chat the server picks the recipient (the other party of the order).
      const saved = fromApi(await chatApi.send({ order, recipient: order ? undefined : ref.other ?? undefined, content }));
      patchThread(key, base, (t) => ({
        ...t,
        other: t.other || saved.recipient,
        messages: upsert(t.messages.filter((m) => m.id !== tempId), saved, me),
      }));
    } catch {
      patchThread(key, base, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === tempId ? { ...m, local: 'failed' as const } : m)) }));
    }
  },

  async retry(key: string, tempId: string): Promise<void> {
    const t = state.threads[key];
    const m = t?.messages.find((x) => x.id === tempId);
    if (!t || !m) return;
    chat.discard(key, tempId);
    await chat.send({ order: t.order, other: t.other }, m.content);
  },

  discard(key: string, tempId: string) {
    const t = state.threads[key];
    if (t) patchThread(key, baseFor(key, t.order, t.other), (x) => ({ ...x, messages: x.messages.filter((m) => m.id !== tempId) }));
  },

  /** Delete one of my messages (the server broadcasts the removal to both sides). */
  async remove(key: string, id: string): Promise<void> {
    const t = state.threads[key];
    if (!t) return;
    const before = t.messages;
    patchThread(key, baseFor(key, t.order, t.other), (x) => ({ ...x, messages: x.messages.filter((m) => m.id !== id) }));
    try {
      await chatApi.remove(id);
    } catch {
      patchThread(key, baseFor(key, t.order, t.other), (x) => ({ ...x, messages: before }));
    }
  },
};

export const unreadTotal = (s: ChatState): number => Object.values(s.threads).reduce((n, t) => n + t.unread, 0);
