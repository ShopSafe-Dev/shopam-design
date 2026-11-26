'use client';

import { useCallback, useEffect, useState } from 'react';
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
  };
}

export function useVendorProfile() {
  const [data, setData] = useState<VendorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const full = await authService.getFullProfile();
      setData(toView(full.user, full.vendor_profile));
    } catch {
      setError('Could not load your business profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { vendor: data, loading, error, reload: load };
}
