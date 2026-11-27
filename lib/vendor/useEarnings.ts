'use client';

import { useCallback, useEffect, useState } from 'react';
import { earningsService, type Earnings } from '@/lib/api/earnings';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';

/** Real earnings from the server. Refreshes in place when an order or payout changes. */
export function useEarnings(limit = 20) {
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setData(await earningsService.get(limit));
        setError('');
      } catch {
        if (!silent) setError('Could not load your earnings.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: !loading, interval: 60_000, topics: ['order'] });

  return { earnings: data, loading, error, reload: () => load() };
}
