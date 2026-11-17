import type { UserProfile } from '../api/types';

/**
 * Tiny in-memory user store. The session itself lives in the backend's HttpOnly
 * cookie (auth_session), which JS cannot read, so NO access/refresh token is ever
 * stored in the browser. The server (GET /api/accounts/profile) is the source of truth;
 * this store only caches the profile it returns.
 *
 * status:
 *   'unknown'       not yet checked against the server this page load
 *   'authenticated' server confirmed a session
 *   'guest'         server said 401 / user logged out
 *
 * A copy of the profile (no credentials) is kept in sessionStorage so a reload
 * renders instantly; it is always re-validated by authService.ensureUser().
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'guest';
export interface AuthState {
  user: UserProfile | null;
  status: AuthStatus;
}

const KEY = 'ss_user';
const SERVER_STATE: AuthState = { user: null, status: 'unknown' };

let state: AuthState = SERVER_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) state = { user: JSON.parse(raw) as UserProfile, status: 'unknown' };
  } catch {
    /* ignore corrupt snapshot */
  }
}

/** Non-secret hint cookie (role only) kept from the old flow. */
function setRoleCookie(isVendor: boolean) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `shopam_role=${isVendor ? 'vendor' : 'customer'}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}
export function clearRoleCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'shopam_role=; Path=/; Max-Age=0; SameSite=Lax';
}

export function getState(): AuthState {
  hydrate();
  return state;
}
export const getServerState = (): AuthState => SERVER_STATE;

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setUser(user: UserProfile): void {
  hydrate();
  state = { user, status: 'authenticated' };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* storage blocked: memory only */
  }
  setRoleCookie(!!user.is_vendor);
  emit();
}

export function clearUser(): void {
  hydrate();
  state = { user: null, status: 'guest' };
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  clearRoleCookie();
  emit();
}
