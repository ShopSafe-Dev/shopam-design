/**
 * Client-safe API settings. Next only inlines NEXT_PUBLIC_* when written literally,
 * so keep each `process.env.NEXT_PUBLIC_X` as-is (no dynamic lookups).
 *
 * NEXT_PUBLIC_API_BASE_URL
 *   Where the BROWSER sends API calls. Leave unset (or empty) to use the Next.js proxy
 *   (/api/* and /staff/* on the same origin). That is the supported setup: the backend
 *   session is an HttpOnly cookie, which only works first-party through the proxy.
 *   Set an absolute URL only if the backend serves CORS with credentials for your origin.
 *
 * NEXT_PUBLIC_WS_URL
 *   Full wss:// URL of the chat socket, no query string (WS route is not in the OpenAPI spec).
 */
const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** No trailing slash. '' means same-origin proxy. */
export const API_BASE_URL: string = rawBase.replace(/\/+$/, '');

/** True when the browser talks to the backend directly instead of the proxy. */
export const API_IS_CROSS_ORIGIN: boolean = API_BASE_URL !== '';

export const WS_URL: string | undefined = process.env.NEXT_PUBLIC_WS_URL || undefined;
