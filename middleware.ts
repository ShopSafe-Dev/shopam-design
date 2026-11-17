import { NextResponse } from 'next/server';

// Middleware is intentionally a passthrough.
// Route protection is handled client-side:
//   - Dashboard: app/dashboard/layout.tsx calls authService.ensureUser()
//   - Cart: app/cart/page.tsx calls authService.ensureUser()
// The session is the backend's HttpOnly cookie (auth_session); no token lives in the
// browser. Expired sessions (401 SESSION_INVALID) clear the cached user in the Axios
// interceptor in lib/api/config.ts. Mixing cookie-based middleware guards with
// client-side state caused redirect loops.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
