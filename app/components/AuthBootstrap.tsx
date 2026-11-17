'use client';

import { useEffect } from 'react';
import { authService } from '@/lib/api';

/** Validates the cookie session once per page load by calling GET /api/accounts/profile. */
export default function AuthBootstrap() {
  useEffect(() => {
    void authService.ensureUser();
  }, []);
  return null;
}
