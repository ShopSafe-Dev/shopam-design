'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getState, getServerState, subscribe } from './session';
import { authService } from '../api/auth';

/** const { user, status, isVendor } = useUser();  status 'unknown' = still checking. */
export function useUser() {
  const s = useSyncExternalStore(subscribe, getState, getServerState);
  useEffect(() => {
    void authService.ensureUser();
  }, []);
  return {
    user: s.user,
    status: s.status,
    loading: s.status === 'unknown',
    isAuthenticated: s.user !== null,
    isVendor: !!s.user?.is_vendor,
  };
}
