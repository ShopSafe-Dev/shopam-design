'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { authService } from '@/lib/api';
import type { BankDetails, UserProfile, VendorProfile, VerificationInfo } from '@/lib/api';

export interface VendorView {
  id: string;
  name: string;
  category: string;
  address: string;
  bio: string;
  logo: string | null;
  cac: string;
  tin: string;
  phone: string;
  cacVerified: boolean;
  tinVerified: boolean;
  addressVerified: boolean;
  /** Server-reported state per section; undefined = never submitted. */
  verification: Partial<Record<'cac' | 'tin' | 'address' | 'bank', VerificationInfo>>;
  bank: BankDetails | null;
  /** Staff suspended the shop: hidden, no new orders, payouts held. */
  suspended: boolean;
  suspendedReason: string;
}

/** Everything the vendor UI shows comes from GET /api/accounts/profile -> vendor_profile (+ the user's phone). */
function toView(user: UserProfile, vp: VendorProfile | undefined): VendorView {
  return {
    id: user.id,
    name: vp?.business_name ?? '',
    category: vp?.business_category ?? '',
    address: vp?.business_address ?? '',
    bio: vp?.bio ?? '',
    logo: vp?.logo ?? null,
    cac: vp?.cac_registration ?? '',
    tin: vp?.tin ?? '',
    phone: user.phone ?? '',
    cacVerified: !!vp?.cac_verified,
    tinVerified: !!vp?.tin_verified,
    addressVerified: !!vp?.address_verified,
    verification: vp?.verification_status ?? {},
    bank: vp?.bank_details ?? null,
    suspended: !!(vp as { is_suspended?: boolean } | undefined)?.is_suspended,
    suspendedReason: (vp as { suspended_reason?: string } | undefined)?.suspended_reason ?? '',
  };
}

export function useVendorProfile() {
  const [data, setData] = useState<VendorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** `silent` refreshes in place (no spinner, keeps old data on failure) for live updates. */
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const full = await authService.getFullProfile();
      setData(toView(full.user, full.vendor_profile));
    } catch {
      if (!silent) setError('Could not load your business profile.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => load(false), [load]);
  useLiveRefresh(() => load(true), { enabled: !loading && !!data, interval: 60_000, topics: ['verification', 'profile'] });

  return { vendor: data, loading, error, reload };
}
