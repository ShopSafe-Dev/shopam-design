'use client';

import { useEffect, useRef } from 'react';
import { ReconnectingSocket } from '@/lib/api/ws';
import { WS_NOTIFICATIONS_URL } from '@/lib/api/env';

/**
 * Calls `onPush` whenever the server pushes a notification ({alert, count, id, priority}).
 * The frame carries only a short text, so callers refetch the list to get the full, named notification.
 * Without a socket URL it does nothing and the caller keeps its normal fetch/poll.
 */
export function useNotificationPush(enabled: boolean, onPush: () => void) {
  const cb = useRef(onPush);
  cb.current = onPush;

  useEffect(() => {
    if (!enabled || !WS_NOTIFICATIONS_URL) return;
    const sock = new ReconnectingSocket({
      url: WS_NOTIFICATIONS_URL,
      onMessage: (raw) => {
        if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'pong') return;
        cb.current();
      },
    });
    sock.connect().catch(() => {});
    // The server drops idle sockets from their group: ping every 40 s.
    const beat = setInterval(() => sock.send({ type: 'ping' }), 40_000);
    return () => {
      clearInterval(beat);
      sock.close();
    };
  }, [enabled]);
}
