'use client';

import { useEffect, useRef } from 'react';
import { isPushOpen, subscribePush } from './bus';

/** Topics the backend emits (see notifications/events.py). */
export type LiveTopic =
  | 'order'
  | 'product'
  | 'cart'
  | 'verification'
  | 'profile'
  | 'social'
  | 'notification'
  | 'staff:verification';

/**
 * Keeps a screen fresh without a manual reload. `refresh` should re-read the data WITHOUT a loading spinner
 * (a silent refresh), so the page updates in place.
 *
 * It runs when:
 *  - the server pushes an event whose topic is in `topics` (any push when `topics` is omitted),
 *  - the tab becomes visible again, the window regains focus, or the network returns,
 *  - on a timer while the tab is visible (every `interval` ms, 4x slower while the push socket is connected).
 * Runs never overlap and are at least 1.5 s apart.
 */
export function useLiveRefresh(
  refresh: () => unknown | Promise<unknown>,
  opts: { enabled?: boolean; interval?: number; push?: boolean; topics?: LiveTopic[] } = {}
) {
  const { enabled = true, interval = 30_000, push = true, topics } = opts;
  const topicKey = topics ? topics.join('|') : '';
  const fn = useRef(refresh);
  fn.current = refresh;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    let busy = false;
    let last = 0;
    let stopped = false;
    let tick: ReturnType<typeof setTimeout> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (busy || stopped || Date.now() - last < 1500) return;
      busy = true;
      try {
        await fn.current();
      } catch {
        /* a failed background refresh keeps what is on screen */
      } finally {
        last = Date.now();
        busy = false;
      }
    };

    const onVisible = () => {
      if (!document.hidden) void run();
    };
    const onFocus = () => void run();
    const onOnline = () => void run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    const unsub = push
      ? subscribePush((ev) => {
          if (topicKey && !topicKey.split('|').includes(ev.topic)) return;
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void run(), 300);
        })
      : null;

    const schedule = () => {
      tick = setTimeout(() => {
        if (!document.hidden) void run();
        if (!stopped) schedule();
      }, isPushOpen() ? interval * 4 : interval);
    };
    schedule();

    return () => {
      stopped = true;
      if (tick) clearTimeout(tick);
      if (debounce) clearTimeout(debounce);
      unsub?.();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, interval, push, topicKey]);
}
