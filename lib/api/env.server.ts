/**
 * Server-only settings (route handlers). Never import this from client components.
 *
 * BACKEND_API_URL  Origin the Next.js proxy forwards /api/* and /staff/* to,
 *                  e.g. https://stag-api.shopsafeng.com  (no trailing slash).
 */
const DEFAULT_BACKEND = 'https://stag-api.shopsafeng.com';

export const BACKEND_API_URL: string = (process.env.BACKEND_API_URL || DEFAULT_BACKEND).replace(/\/+$/, '');
