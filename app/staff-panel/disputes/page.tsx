'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { disputesService, type DisputeSummary } from '@/lib/api/disputes';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import DisputeBadge from '@/app/components/disputes/DisputeBadge';
import { Card, Empty, ErrorBox, PageHeader, Spinner, btn, errMsg, fmtDate, inputCls, naira } from '../ui';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'refund_pending', label: 'Refund to send' },
  { id: 'resolved', label: 'Resolved' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

export default function StaffDisputesPage() {
  const [items, setItems] = useState<DisputeSummary[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const r = await disputesService.staffList({ status: filter, q: term || undefined, page });
        setItems(r.results);
        setCount(r.count);
        setHasNext(!!r.next);
      } catch (err) {
        if (!silent) setError(errMsg(err, 'Could not load disputes.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, term, page]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: !loading, topics: ['staff:dispute'] });

  return (
    <>
      <PageHeader title="Disputes" subtitle={`${count} ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}. Oldest open first.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${filter === f.id ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {f.label}
          </button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Order ref, customer email, shop" className={`${inputCls} sm:ml-auto sm:!w-64`} />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : items.length === 0 ? (
        <Card><Empty text="Nothing here." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {items.map((d) => (
            <Link key={d.id} href={`/staff-panel/disputes/${d.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  <span className="mr-2 font-mono text-xs text-slate-500">#{d.order_ref}</span>
                  {d.customer_name} vs {d.vendor_name}
                </p>
                <DisputeBadge dispute={d} viewer="staff" />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {d.category_label} · {naira(Number(d.amount) || 0)} · opened {fmtDate(d.created_at)}
              </p>
            </Link>
          ))}
        </Card>
      )}

      {(page > 1 || hasNext) && (
        <div className="mt-4 flex items-center justify-between">
          <button className={btn.ghost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-xs text-slate-600">Page {page}</span>
          <button className={btn.ghost} disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
