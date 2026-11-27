'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { disputesService, type DisputeSummary } from '@/lib/api/disputes';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { money } from '@/lib/order-steps';
import DisputeBadge from './DisputeBadge';

/**
 * The signed-in customer's disputes. With ?order=<id> in the URL it jumps straight to that order's dispute
 * (links from the order screens use this).
 */
export default function DisputeList({ hrefBase }: { hrefBase: string }) {
  const router = useRouter();
  const [items, setItems] = useState<DisputeSummary[]>([]);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get('order');
    if (!order) return;
    disputesService
      .list({ order })
      .then((r) => {
        if (r.results[0]) router.replace(`${hrefBase}/${r.results[0].id}`);
      })
      .catch(() => {});
  }, [hrefBase, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await disputesService.list({ status: filter === 'all' ? undefined : filter, page: 1 });
        setItems(r.results);
        setError('');
      } catch {
        if (!silent) setError('Could not load disputes.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: !loading, topics: ['dispute'] });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${filter === f ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
          {error} <button onClick={() => load()} className="ml-2 font-semibold underline">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-600">
          {filter === 'open' ? 'No open disputes.' : 'No disputes here.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {items.map((d) => (
            <Link key={d.id} href={`${hrefBase}/${d.id}`} className="block border-b border-slate-50 px-4 py-3.5 last:border-0 hover:bg-slate-50/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-ink">
                  Order #{d.order_ref} · {d.vendor_name}
                </p>
                <DisputeBadge dispute={d} viewer="customer" />
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-700">{d.category_label} · {money(Number(d.amount) || 0)}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{d.reason}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
