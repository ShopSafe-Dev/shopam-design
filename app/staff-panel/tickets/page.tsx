'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { staffApi } from '@/lib/api/endpoints/staff';
import type * as S from '@/lib/api/openapi-types';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { asList, Badge, Card, Empty, ErrorBox, PageHeader, PRIORITY_TONE, Spinner, STATUS_TONE, btn, errMsg, fmtDate, inputCls } from '../ui';

const FILTERS = ['all', 'open', 'pending', 'resolved', 'rejected', 'closed'] as const;
type Row = S.SupportTicketList & { user_email?: string; user_name?: string };

/** Staff queue. Filtering and search run on the server, so every ticket is reachable, not just the first page. */
export default function StaffTicketsPage() {
  const [tickets, setTickets] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const query: Record<string, string | number> = { page };
        if (filter !== 'all') query.status = filter;
        if (term) query.q = term;
        const raw = (await staffApi.ticketsList(query)) as unknown;
        setTickets(asList<Row>(raw));
        const meta = raw as { count?: number; next?: string | null };
        setCount(typeof meta.count === 'number' ? meta.count : asList<Row>(raw).length);
        setHasNext(!!meta.next);
      } catch (err) {
        if (!silent) setError(errMsg(err, 'Could not load tickets.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, term, page]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: !loading, topics: ['staff:support'] });

  const choose = (f: (typeof FILTERS)[number]) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Support tickets" subtitle={`${count} ${filter === 'all' ? 'total' : filter}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => choose(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${filter === f ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {f}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Reference, subject or email"
          className={`${inputCls} sm:ml-auto sm:!w-64`}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : tickets.length === 0 ? (
        <Card><Empty text="No tickets match." /></Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {tickets.map((t) => (
            <Link key={t.id} href={`/staff-panel/tickets/${t.id}`} className="block px-4 py-3.5 transition-colors hover:bg-slate-50">
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
                {t.user_name || t.user_email ? `${t.user_name || t.user_email} · ` : ''}
                {t.category} · last activity {fmtDate(t.last_activity_at ?? t.created_at)}
              </p>
              {t.last_message?.body && <p className="mt-1 line-clamp-1 text-xs text-slate-600">{t.last_message.body}</p>}
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
