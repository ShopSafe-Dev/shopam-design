import type { UserProfile } from '../api/types';

/**
 * Vendor mode / customer mode.
 *
 * A signed-in person acts as exactly one of: 'vendor', 'customer', 'staff'.
 *  - staff   : is_admin. Never vendor or customer; only /staff-panel.
 *  - vendor  : is_vendor and the chosen mode is vendor.
 *  - customer: everyone else (or a vendor who switched to customer mode).
 * The chosen mode is a per-browser UI preference (localStorage). It is NOT a
 * security boundary: the backend must still enforce permissions on every call.
 */
export type Mode = 'vendor' | 'customer' | 'staff';

const KEY = 'ss_mode';
const listeners = new Set<() => void>();
let chosen: 'vendor' | 'customer' | null | undefined; // undefined = not read yet

function read(): 'vendor' | 'customer' | null {
  if (chosen !== undefined) return chosen;
  try {
    const v = localStorage.getItem(KEY);
    chosen = v === 'vendor' || v === 'customer' ? v : null;
  } catch {
    chosen = null;
  }
  return chosen;
}

export const canBeVendor = (u: UserProfile | null | undefined) => !!u && !u.is_admin && !!u.is_vendor;
// Every non-staff account can act as a customer; is_customer is ignored (vendors may have it false).
export const canBeCustomer = (u: UserProfile | null | undefined) => !!u && !u.is_admin;
export const canSwitchMode = (u: UserProfile | null | undefined) => canBeVendor(u) && canBeCustomer(u);

export function getMode(u: UserProfile | null | undefined): Mode | null {
  if (!u) return null;
  if (u.is_admin) return 'staff';
  const v = canBeVendor(u);
  if (!v) return 'customer';
  const pick = typeof window === 'undefined' ? null : read();
  return pick ?? (v ? 'vendor' : 'customer');
}

export function setMode(m: 'vendor' | 'customer'): void {
  chosen = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function clearMode(): void {
  chosen = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeMode(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const homeFor = (m: Mode | null) => (m === 'staff' ? '/staff-panel' : m === 'vendor' ? '/dashboard' : '/explore');

// Path rules. Anything not listed (explore, feed, products, vendors, notifications, support)
// is shared browsing for vendor and customer modes, but still closed to staff.
const OPEN = ['/auth', '/terms', '/privacy', '/staff-panel', '/staff', '/api'];
const VENDOR_ONLY = ['/dashboard'];
const CUSTOMER_ONLY = ['/cart', '/checkout', '/profile'];

const under = (p: string, base: string) => p === base || p.startsWith(base + '/');

/** Where must `mode` go from `pathname`? null = stay. */
export function redirectFor(pathname: string, mode: Mode | null): string | null {
  if (!mode || pathname === '/' || OPEN.some((b) => under(pathname, b))) return null;
  if (mode === 'staff') return '/staff-panel';
  // Customer chat lives under /chats, vendor chat under /dashboard/messages. They never share a window.
  if (mode === 'vendor' && under(pathname, '/chats')) {
    const m = pathname.match(/^\/chats\/with\/([^/]+)/);
    if (m) return `/dashboard/messages/${m[1]}`;
    return pathname === '/chats' ? '/dashboard/messages' : '/dashboard/orders';
  }
  if (mode === 'customer' && VENDOR_ONLY.some((b) => under(pathname, b))) return '/explore';
  if (mode === 'vendor' && CUSTOMER_ONLY.some((b) => under(pathname, b))) return '/dashboard';
  return null;
}
