'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useUser } from '@/lib/auth/useUser';
import { chat, unreadOf, type ChatState, type Link } from './store';
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
  userId: string;
  name: string;
  last: ChatMsg;
  unread: number;
}

/** Inbox rows, newest first, plus the total unread. Used by both inbox pages and the nav badges. */
export function useConversations() {
  const s = useChatRuntime();
  const list = useMemo<Conversation[]>(() => {
    const rows: Conversation[] = [];
    for (const [userId, t] of Object.entries(s.threads)) {
      const last = t.messages[t.messages.length - 1];
      if (!last) continue;
      rows.push({ userId, name: t.name || 'Chat', last, unread: unreadOf(s, userId) });
    }
    return rows.sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [s]);
  const unreadTotal = useMemo(() => list.reduce((n, c) => n + c.unread, 0), [list]);
  return {
    list,
    unreadTotal,
    loading: s.inboxLoading && !s.inboxLoaded,
    loaded: s.inboxLoaded,
    error: s.inboxError,
    link: s.link as Link,
    reload: () => chat.loadInbox(),
  };
}

export function useUnreadTotal(): number {
  return useConversations().unreadTotal;
}

/** One conversation with `otherId`. Marks it read while it is open and visible. */
export function useThread(otherId: string) {
  const s = useChatRuntime();
  const t = s.threads[otherId];
  const ready = Boolean(s.meId);

  useEffect(() => {
    if (!ready || !otherId) return;
    chat.setActive(otherId);
    void chat.loadThread(otherId);
    return () => chat.setActive(null);
  }, [ready, otherId]);

  const count = t?.messages.length ?? 0;
  useEffect(() => {
    if (ready && otherId && document.visibilityState === 'visible') chat.markRead(otherId);
  }, [ready, otherId, count]);

  const send = useCallback((text: string) => chat.send(otherId, text), [otherId]);
  const retry = useCallback((id: string) => chat.retry(otherId, id), [otherId]);
  const discard = useCallback((id: string) => chat.discard(otherId, id), [otherId]);
  const loadOlder = useCallback(() => chat.loadOlder(otherId), [otherId]);

  return {
    meId: s.meId,
    messages: t?.messages ?? [],
    name: t?.name ?? '',
    loading: !t || (t.loading && !t.full),
    loadingOlder: t?.loadingOlder ?? false,
    hasMore: t?.hasMore ?? false,
    error: t?.error ?? '',
    link: s.link as Link,
    send,
    retry,
    discard,
    loadOlder,
    reload: () => chat.loadThread(otherId),
  };
}
