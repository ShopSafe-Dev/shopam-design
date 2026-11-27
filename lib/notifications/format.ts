import type { Notification } from '@/lib/api/types';

const UUIDISH = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const clean = (s?: string | null) => (s && !UUIDISH.test(s.trim()) ? s.trim() : '');

/**
 * Name + sentence for a notification. The API sends `actor_name` (business name for a vendor, person name for a
 * customer) and a finished `message`. Never falls back to an id or a raw username that is a UUID.
 */
export function notificationParts(n: Notification): { name: string; rest: string } {
  const name =
    clean(n.actor_name) ||
    clean([n.actor?.first_name, n.actor?.last_name].filter(Boolean).join(' ')) ||
    clean(n.actor?.username);
  const msg = n.message || '';
  if (msg) {
    if (name && msg.startsWith(name)) return { name, rest: msg.slice(name.length).trimStart() };
    return { name: '', rest: msg };
  }
  const verb = n.count && n.count > 1 && name ? `and ${n.count - 1} other${n.count > 2 ? 's' : ''} ${n.verb}` : n.verb;
  return { name, rest: verb };
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** like | comment | share | follow | order | dispute | support | refund | payout | weekly_digest | other (older API: guessed). */
export function notificationKind(n: Notification): string {
  if (n.kind) return n.kind;
  const d = n.data ?? {};
  if (str(d.kind)) return d.kind as string;
  if (str(d.dispute_id)) return 'dispute';
  if (str(d.ticket_id)) return 'support';
  if (str(d.order_id)) return 'order';
  if (/liked your post/.test(n.verb)) return 'like';
  if (/commented on your post/.test(n.verb)) return 'comment';
  if (/shared your post/.test(n.verb)) return 'share';
  if (/following you/.test(n.verb)) return 'follow';
  return 'other';
}

/** Where tapping a notification should go, for whoever is looking (vendor dashboard, shopper, staff). */
export function notificationHref(n: Notification, mode: 'vendor' | 'customer' | 'staff' | null): string | null {
  const d = n.data ?? {};
  const kind = notificationKind(n);
  const disputeId = str(d.dispute_id);
  const ticketId = str(d.ticket_id);
  const orderId = str(d.order_id);
  const postId = n.post_id ?? str(d.post_id);

  if (disputeId) {
    if (mode === 'staff') return `/staff-panel/disputes/${disputeId}`;
    // Vendors talk about a dispute only through a support ticket staff open with them.
    return mode === 'vendor' ? '/dashboard/support' : `/disputes/${disputeId}`;
  }
  if (ticketId) {
    if (mode === 'staff') return `/staff-panel/tickets/${ticketId}`;
    return mode === 'vendor' ? `/dashboard/support/${ticketId}` : `/support/${ticketId}`;
  }
  if (orderId) return mode === 'vendor' ? `/dashboard/messages/order/${orderId}` : `/chats/${orderId}`;
  if (kind === 'like' || kind === 'comment' || kind === 'share') {
    // Social notifications go to the post's owner, a vendor: open it in Posts with its numbers.
    return postId ? `/dashboard/posts?post=${postId}` : '/dashboard/posts';
  }
  if (kind === 'follow') return '/dashboard/analytics?tab=overview';
  if (kind === 'weekly_digest') return '/dashboard/analytics?tab=overview';
  if (n.target_type === 'socialpost') return '/feed';
  return null;
}
