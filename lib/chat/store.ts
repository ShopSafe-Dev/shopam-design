import { api } from '@/lib/api/endpoints';
import type { PaginatedMessageList } from '@/lib/api/openapi-types';
import { ReconnectingSocket, type SocketStatus } from '@/lib/api/ws';
import { fromApi, MAX_LEN, parseSocketEvent, type ChatMsg } from './types';

/**
 * One chat store for the whole tab, shared by the customer and vendor UIs.
 *  - One WebSocket (ticket auth, see lib/api/ws.ts), reference counted by start().
 *  - Threads are keyed by the OTHER person's user id. A message is mine iff sender === meId.
 *  - When the socket is not open, active views are refetched every few seconds instead.
 *  - Unread is tracked per browser (the API has no read flag): a message is unread when it is
 *    from the other person and newer than the last time that thread was open on screen.
 */
export type Link = SocketStatus | 'unavailable';

export interface ThreadState {
  messages: ChatMsg[]; // ascending by time
  full: boolean; // the thread endpoint has been loaded (not just inbox snippets)
  loading: boolean;
  loadingOlder: boolean;
  error: string;
  hasMore: boolean;
  cursor: string | null;
  name: string;
}

export interface ChatState {
  meId: string | null;
  link: Link;
  inboxLoading: boolean;
  inboxLoaded: boolean;
  inboxError: string;
  threads: Record<string, ThreadState>;
  read: Record<string, string>;
  active: string | null;
}

const INITIAL: ChatState = {
  meId: null,
  link: 'idle',
  inboxLoading: false,
  inboxLoaded: false,
  inboxError: '',
  threads: {},
  read: {},
  active: null,
};

const emptyThread = (name = ''): ThreadState => ({
  messages: [],
  full: false,
  loading: false,
  loadingOlder: false,
  error: '',
  hasMore: false,
  cursor: null,
  name,
});

let state: ChatState = INITIAL;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(patch: Partial<ChatState>) {
  state = { ...state, ...patch };
  emit();
}
function patchThread(other: string, fn: (t: ThreadState) => ThreadState) {
  const cur = state.threads[other] ?? emptyThread();
  set({ threads: { ...state.threads, [other]: fn(cur) } });
}

/* ───────────── helpers ───────────── */
const ts = (m: ChatMsg) => new Date(m.created_at).getTime() || 0;
const sortAsc = (a: ChatMsg, b: ChatMsg) => ts(a) - ts(b) || a.id.localeCompare(b.id);
const otherOf = (m: ChatMsg, me: string) => (m.sender === me ? m.recipient : m.sender);
const nameOf = (m: ChatMsg, me: string) => (m.sender === me ? m.recipient_name : m.sender_name) || '';

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

function ingest(msg: ChatMsg) {
  const me = state.meId;
  if (!me || (msg.sender !== me && msg.recipient !== me)) return;
  const other = otherOf(msg, me);
  const name = nameOf(msg, me);
  patchThread(other, (t) => ({ ...t, name: t.name || name, messages: upsert(t.messages, msg, me) }));
  if (state.active === other && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    chat.markRead(other);
  }
}

const cursorOf = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url, 'http://x.invalid').searchParams.get('cursor');
  } catch {
    return null;
  }
};

/**
 * The list ordering is not in the spec, so detect it. Newest-first (the usual chat setup): `next`
 * leads to older pages and we load on demand. Oldest-first: the newest message is on the last
 * page, so follow `next` until the end (capped) to reach it.
 */
async function readPages(fetchPage: (cursor?: string) => Promise<PaginatedMessageList>, opts: { cursor?: string; descendingPages: number; ascendingCap: number }) {
  const first = await fetchPage(opts.cursor);
  let items = first.results ?? [];
  let next = cursorOf(first.next);
  const t = (m: { created_at: string }) => new Date(m.created_at).getTime();
  const descending = items.length < 2 || t(items[0]) >= t(items[items.length - 1]);
  let pages = 1;
  const cap = descending ? opts.descendingPages : opts.ascendingCap;
  while (next && pages < cap) {
    const p = await fetchPage(next);
    items = items.concat(p.results ?? []);
    next = cursorOf(p.next);
    pages += 1;
  }
  return { items, next: descending ? next : null };
}

/* ───────────── persistence of "last read" ───────────── */
const readKey = (me: string) => `ss_chat_read:${me}`;
let readFresh = false;

function loadRead(me: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(readKey(me));
    if (raw === null) {
      readFresh = true;
      return {};
    }
    readFresh = false;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    readFresh = false;
    return {};
  }
}
function saveRead(me: string, map: Record<string, string>) {
  try {
    localStorage.setItem(readKey(me), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/* ───────────── runtime (socket + polling) ───────────── */
let refs = 0;
let sock: ReconnectingSocket | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
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
        if (wasOpen === false && state.inboxLoaded) void chat.refresh(); // catch up on anything missed while down
        wasOpen = true;
      } else {
        wasOpen = false;
      }
    },
    onMessage: (raw) => {
      const msg = parseSocketEvent(raw);
      if (msg) ingest(msg);
      else refreshSoon();
    },
  });
  sock.connect().catch(() => set({ link: 'unavailable' }));
}

function teardown() {
  sock?.close();
  sock = null;
  if (poll) clearInterval(poll);
  poll = null;
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
      set({ meId, read: loadRead(meId), link: 'connecting' });
      connect();
      poll = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (state.link === 'open') return;
        tick += 1;
        void chat.refresh({ inbox: tick % 3 === 0 });
      }, 8000);
      onVisible = () => {
        if (document.visibilityState === 'visible' && state.link !== 'open') void chat.refresh();
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

  /** Recent messages across all conversations (feeds the inbox and unread badges). */
  async loadInbox(): Promise<void> {
    const me = state.meId;
    if (!me || state.inboxLoading) return;
    set({ inboxLoading: true, inboxError: '' });
    try {
      const { items } = await readPages((cursor) => api.posts.messagesList(cursor ? { cursor } : undefined), {
        descendingPages: 3,
        ascendingCap: 25,
      });
      if (state.meId !== me) return;
      const threads = { ...state.threads };
      for (const raw of items) {
        const m = fromApi(raw);
        if (m.sender !== me && m.recipient !== me) continue;
        const other = otherOf(m, me);
        const t = threads[other] ?? emptyThread();
        threads[other] = { ...t, name: t.name || nameOf(m, me), messages: upsert(t.messages, m, me) };
      }
      let read = state.read;
      if (readFresh) {
        // First run in this browser: everything already there counts as read; only new arrivals are unread.
        read = { ...read };
        for (const [other, t] of Object.entries(threads)) {
          const lastIn = [...t.messages].reverse().find((x) => x.sender !== me);
          if (lastIn && !read[other]) read[other] = lastIn.created_at;
        }
        readFresh = false;
        saveRead(me, read);
      }
      set({ threads, read, inboxLoaded: true, inboxLoading: false });
    } catch {
      if (state.meId === me) set({ inboxLoading: false, inboxLoaded: true, inboxError: 'Could not load your messages.' });
    }
  },

  /** Full history for one conversation (first page; older pages on demand). */
  async loadThread(other: string, opts: { silent?: boolean } = {}): Promise<void> {
    const me = state.meId;
    if (!me || !other) return;
    const cur = state.threads[other];
    if (cur?.loading) return;
    if (!opts.silent) patchThread(other, (t) => ({ ...t, loading: true, error: '' }));
    try {
      const { items, next } = await readPages((cursor) => api.posts.messagesThreadList({ user_id: other, ...(cursor ? { cursor } : {}) }), {
        descendingPages: 1,
        ascendingCap: 25,
      });
      if (state.meId !== me) return;
      patchThread(other, (t) => {
        let messages = t.messages;
        let name = t.name;
        for (const raw of items) {
          const m = fromApi(raw);
          messages = upsert(messages, m, me);
          name = name || nameOf(m, me);
        }
        return {
          ...t,
          messages,
          name,
          loading: false,
          full: true,
          error: '',
          hasMore: t.full ? t.hasMore : next !== null,
          cursor: t.full ? t.cursor : next,
        };
      });
    } catch {
      patchThread(other, (t) => ({ ...t, loading: false, error: t.messages.length ? '' : 'Could not load this conversation.' }));
    }
  },

  async loadOlder(other: string): Promise<void> {
    const me = state.meId;
    const t = state.threads[other];
    if (!me || !t || !t.hasMore || !t.cursor || t.loadingOlder) return;
    patchThread(other, (x) => ({ ...x, loadingOlder: true }));
    try {
      const page = await api.posts.messagesThreadList({ user_id: other, cursor: t.cursor });
      if (state.meId !== me) return;
      patchThread(other, (x) => {
        let messages = x.messages;
        for (const raw of page.results ?? []) messages = upsert(messages, fromApi(raw), me);
        const next = cursorOf(page.next);
        return { ...x, messages, loadingOlder: false, cursor: next, hasMore: next !== null };
      });
    } catch {
      patchThread(other, (x) => ({ ...x, loadingOlder: false }));
    }
  },

  /** Refetch what is on screen (active thread) and optionally the inbox. */
  async refresh(opts: { inbox?: boolean } = { inbox: true }): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (state.active) jobs.push(chat.loadThread(state.active, { silent: true }));
    if (opts.inbox !== false) jobs.push(chat.loadInbox());
    await Promise.all(jobs);
  },

  setActive(other: string | null) {
    set({ active: other });
    if (other) chat.markRead(other);
  },

  markRead(other: string) {
    const me = state.meId;
    const t = state.threads[other];
    if (!me || !t) return;
    const lastIn = [...t.messages].reverse().find((m) => m.sender !== me && !m.local);
    if (!lastIn || state.read[other] === lastIn.created_at) return;
    const read = { ...state.read, [other]: lastIn.created_at };
    saveRead(me, read);
    set({ read });
  },

  async send(other: string, text: string): Promise<void> {
    const me = state.meId;
    const content = text.trim();
    if (!me || !other || !content || content.length > MAX_LEN) return;
    const tempId = `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const temp: ChatMsg = { id: tempId, sender: me, recipient: other, content, created_at: new Date().toISOString(), local: 'sending' };
    patchThread(other, (t) => ({ ...t, messages: [...t.messages, temp].sort(sortAsc) }));
    try {
      const saved = fromApi(await api.posts.messagesCreate({ recipient: other, content }));
      patchThread(other, (t) => ({
        ...t,
        messages: upsert(t.messages.filter((m) => m.id !== tempId), saved, me),
      }));
    } catch {
      patchThread(other, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === tempId ? { ...m, local: 'failed' as const } : m)) }));
    }
  },

  async retry(other: string, tempId: string): Promise<void> {
    const t = state.threads[other];
    const m = t?.messages.find((x) => x.id === tempId);
    if (!m) return;
    chat.discard(other, tempId);
    await chat.send(other, m.content);
  },

  discard(other: string, tempId: string) {
    patchThread(other, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== tempId) }));
  },
};

export const unreadOf = (s: ChatState, other: string): number => {
  const me = s.meId;
  const t = s.threads[other];
  if (!me || !t) return 0;
  const since = s.read[other] ? new Date(s.read[other]).getTime() : 0;
  return t.messages.filter((m) => m.sender !== me && !m.local && ts(m) > since).length;
};
