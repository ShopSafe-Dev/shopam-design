'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { financeService, PAYOUT_BUCKETS, type PayoutBucket, type PayoutQueue, type PayResult } from '@/lib/api/finance';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import ConfirmTypeModal from '@/app/components/ui/ConfirmTypeModal';
import { Badge, Card, Empty, ErrorBox, Spinner, btn, errMsg, inputCls, naira } from '../ui';

const MAX_SELECT = 20;
const num = (s: string | null | undefined) => Number(s) || 0;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

function lateBy(due: string | null) {
  if (!due) return '';
  const days = Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000);
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'} late` : '';
}

export default function PayoutQueueTab() {
  const [bucket, setBucket] = useState<PayoutBucket>('overdue');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PayoutQueue | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [results, setResults] = useState<PayResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await financeService.payouts({ bucket, q: query || undefined, page }));
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Could not load payouts.'));
    }
  }, [bucket, query, page]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!data && !busy, interval: 60_000, push: false });

  // Drop selections that are no longer payable after a refresh.
  useEffect(() => {
    if (!data) return;
    const payable = new Set(data.results.filter((r) => r.payable).map((r) => r.order_id));
    setSelected((s) => {
      const next = new Set([...s].filter((id) => payable.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [data]);

  const pick = (b: PayoutBucket) => {
    setBucket(b);
    setPage(1);
    setSelected(new Set());
    setResults(null);
    setData(null);
  };

  const rows = data?.results ?? [];
  const payableRows = rows.filter((r) => r.payable);
  const selectedRows = rows.filter((r) => selected.has(r.order_id));
  const selectedTotal = useMemo(() => selectedRows.reduce((s, r) => s + num(r.vendor_payout), 0), [selectedRows]);
  const canSelect = bucket === 'overdue' || bucket === 'due';
  const allChosen = payableRows.length > 0 && payableRows.slice(0, MAX_SELECT).every((r) => selected.has(r.order_id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX_SELECT) n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(payableRows.slice(0, MAX_SELECT).map((r) => r.order_id)));

  const pay = async () => {
    setBusy(true);
    setPayError('');
    try {
      const out = await financeService.pay([...selected]);
      setResults(out);
      setSelected(new Set());
      setConfirm(false);
      await load();
    } catch (e) {
      setPayError(errMsg(e, 'Could not start the payouts.'));
    } finally {
      setBusy(false);
    }
  };

  const hint = PAYOUT_BUCKETS.find((b) => b.id === bucket)?.hint;
  const refOf = (id: string) => rows.find((r) => r.order_id === id)?.order_ref ?? id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-4">
      {/* bucket chips with counts and totals */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PAYOUT_BUCKETS.map((b) => {
          const s = data?.summary?.[b.id];
          const active = b.id === bucket;
          const alarm = b.id === 'overdue' && (s?.count ?? 0) > 0;
          return (
            <button
              key={b.id}
              onClick={() => pick(b.id)}
              className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-colors ${
                active ? 'border-ink bg-ink text-white' : alarm ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              <span className="block text-xs font-bold">{b.label} {s ? `(${s.count})` : ''}</span>
              <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-slate-500'}`}>{s ? naira(num(s.vendor_payout_total)) : '...'}</span>
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
        className="relative max-w-md"
      >
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order ref, shop name or customer email" className={`${inputCls} pl-9`} />
      </form>

      {results && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">Payout results</h3>
            <button className="text-xs font-semibold text-slate-500 hover:text-ink" onClick={() => setResults(null)}>Dismiss</button>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {results.map((r) => (
              <li key={r.order_id} className={r.ok ? 'text-emerald-700' : 'text-red-600'}>
                <span className="font-mono font-bold">#{refOf(r.order_id)}</span> {r.ok ? 'started' : 'not paid'}: {r.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Started transfers move to &ldquo;In progress&rdquo; and then &ldquo;Paid out&rdquo; when Monnify confirms.</p>
        </Card>
      )}

      {error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty text={query ? 'Nothing matches that search.' : 'Nothing here.'} />
      ) : (
        <Card className="overflow-hidden">
          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {canSelect && (
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" aria-label="Select all payable" checked={allChosen} disabled={!payableRows.length} onChange={toggleAll} />
                    </th>
                  )}
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5 text-right">Paid</th>
                  <th className="px-3 py-2.5 text-right">Vendor gets</th>
                  <th className="px-3 py-2.5 text-right">Our fee</th>
                  <th className="px-3 py-2.5">{bucket === 'paid_out' || bucket === 'refunded' ? 'Paid by customer' : 'Due'}</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.order_id} className={selected.has(r.order_id) ? 'bg-slate-50' : ''}>
                    {canSelect && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select order ${r.order_ref}`}
                          checked={selected.has(r.order_id)}
                          disabled={!r.payable || (!selected.has(r.order_id) && selected.size >= MAX_SELECT)}
                          onChange={() => toggle(r.order_id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <Link href={`/staff-panel/moderation?order=${r.order_id}`} className="font-mono font-bold text-ink hover:underline">#{r.order_ref}</Link>
                      <span className="block text-[11px] text-slate-500">{r.customer_email}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink">{r.vendor_name || '-'}</td>
                    <td className="px-3 py-2.5 text-right">{naira(num(r.amount_paid))}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-ink">{naira(num(r.vendor_payout))}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{naira(num(r.commission))}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {bucket === 'paid_out' || bucket === 'refunded' ? day(r.paid_at) : r.due_at ? day(r.due_at) : 'after delivery'}
                      {bucket === 'overdue' && <span className="block font-semibold text-red-600">{lateBy(r.due_at)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <Badge tone={r.payable ? 'amber' : bucket === 'paid_out' ? 'green' : bucket === 'held' ? 'red' : 'slate'}>{r.order_status}</Badge>
                      {r.reason && <span className="mt-1 block max-w-[220px] text-red-600">{r.reason}</span>}
                      {!r.reason && r.payout_failure_reason && <span className="mt-1 block max-w-[220px] text-slate-500">Last try: {r.payout_failure_reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {canSelect && payableRows.length > 0 && (
              <li className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={allChosen} onChange={toggleAll} /> Select all payable on this page
              </li>
            )}
            {rows.map((r) => (
              <li key={r.order_id} className="flex gap-3 px-4 py-3">
                {canSelect && (
                  <input
                    type="checkbox"
                    className="mt-1"
                    aria-label={`Select order ${r.order_ref}`}
                    checked={selected.has(r.order_id)}
                    disabled={!r.payable || (!selected.has(r.order_id) && selected.size >= MAX_SELECT)}
                    onChange={() => toggle(r.order_id)}
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-bold text-ink">#{r.order_ref}</span>
                    <span className="font-bold text-ink">{naira(num(r.vendor_payout))}</span>
                  </div>
                  <p className="truncate text-xs text-slate-600">{r.vendor_name} · paid {naira(num(r.amount_paid))} · fee {naira(num(r.commission))}</p>
                  <p className="text-xs text-slate-500">
                    {r.due_at ? `Due ${day(r.due_at)}` : 'Due after delivery'}
                    {bucket === 'overdue' && <span className="font-semibold text-red-600"> · {lateBy(r.due_at)}</span>}
                  </p>
                  {r.reason && <p className="text-xs text-red-600">{r.reason}</p>}
                </div>
              </li>
            ))}
          </ul>

          {(data.next || data.previous) && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs">
              <button className={btn.ghost} disabled={!data.previous} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <span className="text-slate-500">Page {page} · {data.count} orders</span>
              <button className={btn.ghost} disabled={!data.next} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </Card>
      )}

      {canSelect && selected.size > 0 && (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg md:bottom-4">
          <span className="text-sm">
            <b>{selected.size}</b> selected · {naira(selectedTotal)} to vendors
            {selected.size >= MAX_SELECT && <span className="block text-[11px] text-white/70">At most {MAX_SELECT} per run.</span>}
          </span>
          <div className="flex gap-2">
            <button className="rounded-full px-3 py-2 text-xs font-semibold text-white/80 hover:text-white" onClick={() => setSelected(new Set())}>Clear</button>
            <button className={btn.primary} onClick={() => { setPayError(''); setConfirm(true); }}>Pay selected</button>
          </div>
        </div>
      )}

      <ConfirmTypeModal
        open={confirm}
        title={`Pay ${selected.size} order${selected.size === 1 ? '' : 's'}`}
        description="Each order is checked again on the server and paid through Monnify on its own."
        warning={
          <>
            {naira(selectedTotal)} goes to the vendors&rsquo; bank accounts now. This cannot be reversed from here. Orders that stopped being eligible
            (refunded, disputed, vendor suspended) are skipped and listed with the reason.
          </>
        }
        confirmText="PAY"
        actionLabel="Pay out"
        busy={busy}
        error={payError}
        onConfirm={pay}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
