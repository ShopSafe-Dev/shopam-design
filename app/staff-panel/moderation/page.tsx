'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { moderationService, type AccountRow, type StaffOrder } from '@/lib/api/moderation';
import { Badge, Card, Empty, PageHeader, Spinner, btn, errMsg, fmtDate, inputCls, naira } from '../ui';
import AskPrivately from '../AskPrivately';

/* ------------------------------------------------------------------ shared: an action that needs a reason */

function ReasonAction({
  label,
  confirmLabel,
  tone = 'danger',
  hint,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  tone?: 'danger' | 'dark';
  hint: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) {
    return <button className={btn.ghost} onClick={() => setOpen(true)}>{label}</button>;
  }
  const go = async () => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason('');
    } catch (e) {
      setError(errMsg(e, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-full rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-600">{hint}</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (the person sees it)" className={`${inputCls} mt-2 resize-none`} />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button className={tone === 'danger' ? btn.danger : btn.dark} disabled={busy || reason.trim().length < 5} onClick={go}>
          {busy ? 'Working...' : confirmLabel}
        </button>
        <button className={btn.ghost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ orders */

function OrderCard({ initial }: { initial: StaffOrder }) {
  const [o, setO] = useState(initial);
  const pay = o.payment;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">Order #{o.ref} · {naira(Number(o.total) || 0)}</p>
          <p className="text-xs text-slate-600">{o.customer.name || o.customer.email} buying from {o.vendor.name || 'a shop'} · {fmtDate(o.created_at)}</p>
        </div>
        <Badge tone={o.status === 'cancelled' ? 'red' : o.status === 'completed' ? 'green' : 'blue'}>{o.status}</Badge>
      </div>
      <ul className="text-xs text-slate-700">{o.items.map((i, n) => <li key={n}>{i.quantity} x {i.title}</li>)}</ul>
      {pay ? (
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <div><dt className="text-slate-500">Payment</dt><dd className="font-bold text-ink">{pay.status}</dd></div>
          <div><dt className="text-slate-500">Vendor payout</dt><dd className="font-bold text-ink">{pay.payout_status.replace('_', ' ')}</dd></div>
          <div><dt className="text-slate-500">Refund</dt><dd className="font-bold text-ink">{pay.refund_status || 'none'}</dd></div>
          <div><dt className="text-slate-500">Reference</dt><dd className="truncate font-mono text-ink">{pay.refund_reference || pay.tx_ref}</dd></div>
          {pay.refund_failure_reason && <div className="col-span-full text-red-600">Refund failed: {pay.refund_failure_reason}</div>}
        </dl>
      ) : (
        <p className="text-xs text-slate-600">Not paid yet.</p>
      )}
      {o.refund_result && (
        <p className={`rounded-lg px-3 py-2 text-xs font-medium ${o.refund_result.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{o.refund_result.message}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {o.can_refund ? (
          <ReasonAction
            label={pay?.refund_status === 'failed' ? 'Retry refund' : 'Refund customer and stop payout'}
            confirmLabel={`Refund ${naira(Number(pay?.total) || 0)}`}
            hint="Cancels the order, stops the vendor payout and sends the money back through Monnify. Unshipped stock is put back. An open dispute is closed in the customer's favour."
            onConfirm={async (reason) => setO(await moderationService.refundOrder(o.id, reason))}
          />
        ) : (
          <p className="text-xs text-slate-600">Refund not available: {o.refund_blocked_reason}</p>
        )}
        {o.dispute && <Link href={`/staff-panel/disputes/${o.dispute.id}`} className={btn.ghost}>Dispute ({o.dispute.status})</Link>}
        {o.customer.user_id && <AskPrivately userId={o.customer.user_id} defaultSubject={`Order #${o.ref}: we need your side`} label="Ask the customer privately" />}
        {o.vendor.user_id && <AskPrivately userId={o.vendor.user_id} defaultSubject={`Order #${o.ref}: please explain`} label="Ask the vendor privately" />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ accounts */

function AccountCard({ initial }: { initial: AccountRow }) {
  const [a, setA] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<AccountRow>) => {
    setBusy(true);
    setError('');
    try {
      setA(await fn());
    } catch (e) {
      setError(errMsg(e, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{a.business_name || a.name || a.email}</p>
          <p className="text-xs text-slate-600">{a.email} · {a.phone}{a.business_name && a.name ? ` · ${a.name}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.is_staff && <Badge tone="blue">staff</Badge>}
          {a.business_name && <Badge tone={a.is_suspended ? 'red' : 'green'}>{a.is_suspended ? 'shop suspended' : 'shop live'}</Badge>}
          <Badge tone={a.is_active ? 'green' : 'red'}>{a.is_active ? 'active' : a.deleted_by_user ? 'closed by owner' : 'deactivated'}</Badge>
        </div>
      </div>
      {a.is_suspended && <p className="text-xs text-slate-700">Suspended {fmtDate(a.suspended_at)}: {a.suspended_reason}</p>}
      {a.deactivated_by_staff && <p className="text-xs text-slate-700">Deactivated {fmtDate(a.staff_deactivated_at)}: {a.staff_deactivation_reason}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {!a.is_staff && (
        <div className="flex flex-wrap items-start gap-2">
          <AskPrivately userId={a.user_id} label="Message privately" />
          {a.vendor_profile_id && (a.is_suspended ? (
            <button className={btn.dark} disabled={busy} onClick={() => run(() => moderationService.unsuspend(a.vendor_profile_id!))}>Lift suspension</button>
          ) : (
            <ReasonAction
              label="Suspend shop"
              confirmLabel="Suspend"
              hint="Hides the shop, its products and posts, blocks new orders and holds payouts. The person can still sign in and shop. You can lift it any time."
              onConfirm={async (reason) => setA(await moderationService.suspend(a.vendor_profile_id!, reason))}
            />
          ))}
          {a.is_active ? (
            <ReasonAction
              label="Deactivate account"
              confirmLabel="Deactivate"
              hint="For serious cases. Blocks sign-in and signs them out everywhere; a shop is hidden and its payouts held. You can reactivate it later."
              onConfirm={async (reason) => setA(await moderationService.deactivate(a.user_id, reason))}
            />
          ) : a.deactivated_by_staff ? (
            <button className={btn.dark} disabled={busy} onClick={() => run(() => moderationService.reactivate(a.user_id))}>Reactivate account</button>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

function Search<T>({ placeholder, initial, find, render }: { placeholder: string; initial: string; find: (q: string) => Promise<T[]>; render: (row: T) => React.ReactNode }) {
  const [q, setQ] = useState(initial);
  const [rows, setRows] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (term: string) => {
    if (term.trim().length < 3) return;
    setLoading(true);
    setError('');
    try {
      setRows(await find(term.trim()));
    } catch (e) {
      setError(errMsg(e, 'Search failed.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); void run(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={inputCls} />
        <button className={btn.dark} disabled={q.trim().length < 3}>Search</button>
      </form>
      {loading ? <Spinner /> : error ? <p className="text-sm text-red-600">{error}</p> : rows === null ? null : rows.length === 0 ? <Card><Empty text="Nothing found." /></Card> : rows.map(render)}
    </div>
  );
}

export default function ModerationPage() {
  const [initial, setInitial] = useState({ order: '', account: '' });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setInitial({ order: q.get('order') ?? '', account: q.get('account') ?? '' });
  }, []);

  return (
    <>
      <PageHeader title="Orders & accounts" subtitle="Refund an order, suspend a shop, deactivate or reactivate an account. Every action is recorded in the audit log." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">Order</h2>
          <Search<StaffOrder>
            placeholder="Order ref (8 characters), customer email or shop name"
            initial={initial.order}
            find={moderationService.findOrders}
            render={(o) => <OrderCard key={o.id} initial={o} />}
          />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">Account or shop</h2>
          <Search<AccountRow>
            placeholder="Email, phone, name or shop name"
            initial={initial.account}
            find={moderationService.findAccounts}
            render={(a) => <AccountCard key={a.user_id} initial={a} />}
          />
        </section>
      </div>
    </>
  );
}
