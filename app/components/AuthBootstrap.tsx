'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/lib/api';
import { redirectFor } from '@/lib/auth/mode';
import { useMode } from '@/lib/auth/useMode';
import { useUser } from '@/lib/auth/useUser';

/**
 * Validates the cookie session once per page load (GET /api/accounts/profile) and
 * keeps each person in their mode: staff stay in /staff-panel; vendor mode cannot
 * open customer pages; customer mode cannot open the vendor dashboard.
 * This is UI routing only; the backend enforces the real permissions.
 */
export default function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useUser();
  const { mode } = useMode();

  useEffect(() => {
    void authService.ensureUser();
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return; // only act on a server-confirmed session
    const to = redirectFor(pathname, mode);
    if (to) router.replace(to);
  }, [status, mode, pathname, router]);

  return null;
}
