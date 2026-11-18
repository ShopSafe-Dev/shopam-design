'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/api/endpoints/staff';
import type * as S from '@/lib/api/openapi-types';
import { Badge, Card, Empty, ErrorBox, PageHeader, PRIORITY_TONE, Spinner, STATUS_TONE, errMsg, fmtDate, inputCls } from '../ui';

const FILTERS = ['all', 'open', 'pending', 'resolved', 'rejected', 'closed'] as const;

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<S.SupportTicketList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTickets(await staffApi.ticketsList());
    } catch (err) {
      setError(errMsg(err, 'Could not load tickets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        (filter === 'all' || t.status === filter) &&
        (!term || t.reference.toLowerCase().includes(term) || t.subject.toLowerCase().includes(term))
    );
  }, [tickets, filter, q]);

  return (
    <>
      <PageHeader title="Support tickets" subtitle={`${tickets.length} total`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${filter === f ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {f}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or subject" className={`${inputCls} sm:ml-auto sm:!w-64`} />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Card><Empty text="No tickets match." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {rows.map((t) => (
            <Link key={t.id} href={`/admin/tickets/${t.id}`} className="block px-4 py-3.5 transition-colors hover:bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-bold text-ink">
                  <span className="mr-2 font-mono text-xs text-slate-500">{t.reference}</span>
                  {t.subject}
                </p>
                <div className="flex gap-1.5">
                  {t.priority && <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>}
                  {t.status && <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t.category} · last activity {fmtDate(t.last_activity_at ?? t.created_at)}
              </p>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
