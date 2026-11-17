import type { UserProfile } from './api/types';


const FLAG = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const DEV_AUTH_BYPASS = FLAG && !IS_PRODUCTION;

const ROLE: 'vendor' | 'customer' =
  process.env.NEXT_PUBLIC_DEV_USER_ROLE === 'vendor' ? 'vendor' : 'customer';

export const DEV_USER: UserProfile = {
  id: 'dev-user',
  username: ROLE === 'vendor' ? 'dev-vendor' : 'dev-customer',
  email: 'dev@shopsafe.local',
  first_name: 'Dev',
  last_name: ROLE === 'vendor' ? 'Vendor' : 'Shopper',
  phone: '08000000000',
  is_vendor: ROLE === 'vendor',
  is_customer: ROLE !== 'vendor',
};

/** Dev bypass: authService.* returns DEV_USER directly; only the role hint cookie is set. */
export function ensureDevSession(): void {
  if (!DEV_AUTH_BYPASS || typeof window === 'undefined') return;
  document.cookie = `shopam_role=${ROLE}; Path=/; Max-Age=2592000; SameSite=Lax`;
}
