'use client';

import { API_BASE_URL } from '@/lib/api/env';

/**
 * Reports what the API cannot see by itself: a post seen in a feed (POST /api/analytics/events/, type "view").
 * Each post is reported once per page session; reports are batched (max 20 per request, the server's limit)
 * and sent every few seconds and when the page is hidden. Never throws, never blocks the page.
 */
type Event = { type: 'view'; scope: 'post'; id: string };

const seen = new Set<string>();
let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;

function send(batch: Event[]) {
  try {
    void fetch(`${API_BASE_URL}/api/analytics/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true, // lets the last batch finish while the tab closes
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length) send(queue.splice(0, 20));
}

export function reportPostView(postId: string) {
  if (typeof window === 'undefined' || !postId || seen.has(postId)) return;
  seen.add(postId);
  queue.push({ type: 'view', scope: 'post', id: postId });
  if (!hooked) {
    hooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}
