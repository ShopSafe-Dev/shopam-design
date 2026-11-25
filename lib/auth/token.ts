import axios from 'axios';
import { API_BASE_URL, API_IS_CROSS_ORIGIN } from '../api/env';

/**
 * Access token store. The short-lived access JWT lives only in memory (never localStorage), so a
 * page reload drops it and it is re-issued from the HttpOnly refresh cookie (`ss_refresh`), which
 * JS cannot read. Refresh is single-flight: parallel requests share one refresh call.
 */
const REFRESH_URL = '/api/accounts/token/refresh';
const SKEW_MS = 30_000; // refresh when less than 30s of life remains
const GUEST_COOLDOWN_MS = 30_000; // after a failed refresh, do not retry for a while

let accessToken: string | null = null;
let expiresAt = 0;
let refreshing: Promise<string | null> | null = null;
let failedAt = 0;

// Plain client: no interceptors, so a failing refresh cannot recurse into itself.
const bare = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: API_IS_CROSS_ORIGIN,
});

function decodeExp(token: string): number {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    return typeof json.exp === 'number' ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function setAccessToken(token: string | null | undefined): void {
  if (!token) {
    clearAccessToken();
    return;
  }
  accessToken = token;
  expiresAt = decodeExp(token);
  failedAt = 0;
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAt = 0;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function isFresh(): boolean {
  return !!accessToken && (expiresAt === 0 || expiresAt - Date.now() > SKEW_MS);
}

/** True when this browser has probably signed in before (non-secret hint cookie or cached user). */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.cookie.split('; ').some((c) => c.startsWith('shopam_role='))) return true;
  try {
    return !!sessionStorage.getItem('ss_user');
  } catch {
    return false;
  }
}

/** Exchange the refresh cookie for a new access token. Resolves null when there is no valid session. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = bare
      .post<{ access?: string }>(REFRESH_URL)
      .then((res) => {
        setAccessToken(res.data?.access);
        return accessToken;
      })
      .catch((err) => {
        clearAccessToken();
        // 401 means the session is gone. Anything else (network, 5xx) may be temporary.
        if (err?.response?.status === 401) failedAt = Date.now();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Token to attach to the next request, refreshing first when it is missing or about to expire. */
export async function getValidAccessToken(): Promise<string | null> {
  if (isFresh()) return accessToken;
  if (refreshing) return refreshing;
  if (!hasSessionHint()) return null;
  if (failedAt && Date.now() - failedAt < GUEST_COOLDOWN_MS) return null;
  return refreshAccessToken();
}
