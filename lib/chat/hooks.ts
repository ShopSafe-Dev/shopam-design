'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useUser } from '@/lib/auth/useUser';
import { chat, keyOf, unreadTotal, type ChatState, type Link, type ThreadRef } from './store';
import type { ChatMsg } from './types';

const useChatState = (): ChatState => useSyncExternalStore(chat.subscribe, chat.getState, chat.getServerState);

/** Starts the shared socket + inbox for a signed-in, non-staff user. Safe to call from many components. */
export function useChatRuntime(): ChatState {
  const { user } = useUser();
  const meId = user && !user.is_admin ? user.id : null;
  useEffect(() => {
    if (!meId) return;
    return chat.start(meId);
  }, [meId]);
  return useChatState();
}

export interface Conversation {
  key: string;
  order: string | null;
  orderRef: string | null;
  orderStatus: string | null;
  other: string;
  name: string;
  last: ChatMsg;
  unread: number;
}

/** Inbox rows (one per order chat), newest first, plus the total unread. Used by inbox pages and nav badges. */
export function useConversations() {
  const s = useChatRuntime();
  const list = useMemo<Conversation[]>(() => {
    const rows: Conversation[] = [];
    for (const t of Object.values(s.threads)) {
      const last = t.messages[t.messages.length - 1];
      if (!last) continue;
      rows.push({ key: t.key, order: t.order, orderRef: t.orderRef, orderStatus: t.orderStatus, other: t.other, name: t.name || 'Chat', last, unread: t.unread });
    }
    return rows.sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [s]);
  return {
    list,
    unreadTotal: useMemo(() => unreadTotal(s), [s]),
    /** Unread messages for one order's chat. */
    unreadForOrder: (orderId: string) => s.threads[`order:${orderId}`]?.unread ?? 0,
    loading: s.inboxLoading && !s.inboxLoaded,
    loaded: s.inboxLoaded,
    error: s.inboxError,
    link: s.link as Link,
    reload: () => chat.loadInbox(),
  };
}

export function useUnreadTotal(): number {
  return unreadTotal(useChatRuntime());
}

/** One chat: an order's own stream (`{order}`) or the general stream with a person (`{other}`). */
export function useThread(ref: ThreadRef) {
  const s = useChatRuntime();
  const key = keyOf(ref);
  const order = ref.order ?? null;
  const other = ref.other ?? null;
  const t = s.threads[key];
  const ready = Boolean(s.meId) && Boolean(order || other);

  useEffect(() => {
    if (!ready) return;
    chat.setActive(key);
    void chat.loadThread({ order, other });
    return () => chat.setActive(null);
  }, [ready, key, order, other]);

  const count = t?.messages.length ?? 0;
  useEffect(() => {
    if (ready && document.visibilityState === 'visible') chat.markRead(key);
  }, [ready, key, count]);

  const send = useCallback((text: string) => chat.send({ order, other: other ?? t?.other }, text), [order, other, t?.other]);
  const retry = useCallback((id: string) => chat.retry(key, id), [key]);
  const discard = useCallback((id: string) => chat.discard(key, id), [key]);
  const loadOlder = useCallback(() => chat.loadOlder(key), [key]);
  const remove = useCallback((id: string) => chat.remove(key, id), [key]);

  return {
    meId: s.meId,
    key,
    messages: t?.messages ?? [],
    name: t?.name ?? '',
    other: t?.other ?? other ?? '',
    loading: !ready || !t || (t.loading && !t.full),
    loadingOlder: t?.loadingOlder ?? false,
    hasMore: t?.hasMore ?? false,
    error: t?.error ?? '',
    link: s.link as Link,
    send,
    retry,
    discard,
    remove,
    loadOlder,
    reload: () => chat.loadThread({ order, other }),
  };
}
