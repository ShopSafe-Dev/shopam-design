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

/** Where tapping a notification should go. Order notifications open that order's own chat. */
export function notificationHref(n: Notification, mode: 'vendor' | 'customer' | 'staff' | null): string | null {
  const orderId = typeof n.data?.order_id === 'string' ? n.data.order_id : null;
  if (orderId) return mode === 'vendor' ? `/dashboard/messages/order/${orderId}` : `/chats/${orderId}`;
  if (n.target_type === 'socialpost' && n.target_object_id) return `/feed`;
  return null;
}
