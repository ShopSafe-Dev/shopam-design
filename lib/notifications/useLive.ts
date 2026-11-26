'use client';

import { useEffect, useRef } from 'react';
import { subscribePush } from '@/lib/live/bus';

/**
 * Calls `onPush` whenever the server pushes a notification ({alert, count, id, priority}).
 * The frame carries only a short text, so callers refetch the list to get the full, named notification.
 * Shares one socket with every other live screen (see lib/live/bus.ts). Without a socket URL it does nothing
 * and the caller keeps its normal fetch/poll.
 */
export function useNotificationPush(enabled: boolean, onPush: () => void) {
  const cb = useRef(onPush);
  cb.current = onPush;

  useEffect(() => {
    if (!enabled) return;
    return subscribePush((ev) => {
      if (ev.topic === 'notification') cb.current();
    });
  }, [enabled]);
}
