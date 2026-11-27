'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { disputesService, type DisputeDetail } from '@/lib/api/disputes';
import { moderationService } from '@/lib/api/moderation';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import DisputeBadge from '@/app/components/disputes/DisputeBadge';
import { Badge, Card, ErrorBox, Spinner, STATUS_TONE, btn, errMsg, fmtDate, inputCls, naira } from '../../ui';

/* --------------------------------------------------------------- talk to one side */

function AskPanel({ d, update }: { d: DisputeDetail; update: (d: DisputeDetail) => void }) {
  const [party, setParty] = useState<'customer' | 'vendor'>('customer');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const tickets = d.tickets ?? [];
  const existing = tickets.find((t) => t.party === party && !['closed', 'rejected'].includes(t.status));

  const send = async () => {
    if (message.trim().length < 5) return;
    setBusy(true);
    setError('');
    setSent('');
    try {
      update(await disputesService.ask(d.id, party, message.trim()));
      setMessage('');
      setSent(existing ? `Added to ${existing.reference}.` : `Opened a private ticket with the ${party}.`);
    } catch (e) {
      setError(errMsg(e, 'Could not send.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="text-sm font-bold text-ink">Conversations</h3>
        <p className="mt-0.5 text-xs text-slate-600">
          Each side has its own ticket. Neither can see the other&rsquo;s, or tell whether the other was contacted.
          {!d.vendor_contacted && ' The vendor has not been told about this dispute.'}
        </p>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {(['customer', 'vendor'] as const).map((p) => {
          const t = tickets.find((x) => x.party === p);
          return (
            <div key={p} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-semibold capitalize text-ink">{p} <span className="text-xs font-normal text-slate-500">{p === 'customer' ? d.customer_email : d.vendor_email}</span></span>
              {t ? (
                <span className="flex items-center gap-2">
                  {t.status && <Badge tone={STATUS_TONE[t.status] ?? 'slate'}>{t.status}</Badge>}
                  <Link href={`/staff-panel/tickets/${t.id}`} className="text-xs font-semibold text-ink underline">{t.reference}</Link>
                </span>
              ) : (
                <span className="text-xs text-slate-500">not contacted</span>
              )}
            </div>
          );
        })}
      </div>

      {d.status === 'open' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['customer', 'vendor'] as const).map((p) => (
              <button key={p} onClick={() => setParty(p)} className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${party === p ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700'}`}>
                Ask the {p}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={party === 'customer' ? 'e.g. We saw your dispute. Can you tell us more about what happened?' : 'e.g. The customer reports the item arrived damaged. What is your side of the story?'}
            className={`${inputCls} resize-none`}
          />
          <p className="text-[11px] text-slate-500">
            {existing ? `Goes into ${existing.reference}.` : `Opens a new private ticket for the ${party}. They are emailed.`}
          </p>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          {sent && <p className="text-xs text-emerald-700">{sent}</p>}
          <button className={btn.dark} disabled={busy || message.trim().length < 5} onClick={send}>{busy ? 'Sending...' : 'Send'}</button>
        </div>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- decide / refund */

function ResolvePanel({ d, update }: { d: DisputeDetail; update: (d: DisputeDetail) => void }) {
  const [choice, setChoice] = useState<'vendor' | 'customer' | ''>('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pay = d.payment ?? null;

  if (d.status === 'open') {
    const decide = async () => {
      if (!choice || note.trim().length < 5) return;
      setBusy(true);
      setError('');
      try {
        const out = await disputesService.resolve(d.id, choice, note.trim());
        if (out.refund_result?.status === 'failed') setError(`Decision saved, but the automatic refund failed: ${out.refund_result.message ?? ''}`);
        update(out);
      } catch (e) {
        setError(errMsg(e, 'Could not save the decision.'));
      } finally {
        setBusy(false);
      }
    };
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-ink">Decide</h3>
        <p className="mt-0.5 text-xs text-slate-600">The decision is posted in each open ticket (each side gets its own wording) and those tickets are resolved. This cannot be undone.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-xl border p-3 text-sm ${choice === 'vendor' ? 'border-ink bg-slate-50' : 'border-slate-200'}`}>
            <input type="radio" name="resolution" className="mr-2" checked={choice === 'vendor'} onChange={() => setChoice('vendor')} />
            <span className="font-bold text-ink">Vendor</span>
            <span className="mt-1 block text-xs text-slate-600">Hold is lifted; the vendor is paid once the dispute window has passed.</span>
          </label>
          <label className={`cursor-pointer rounded-xl border p-3 text-sm ${choice === 'customer' ? 'border-ink bg-slate-50' : 'border-slate-200'}`}>
            <input type="radio" name="resolution" className="mr-2" checked={choice === 'customer'} onChange={() => setChoice('customer')} />
            <span className="font-bold text-ink">Customer</span>
            <span className="mt-1 block text-xs text-slate-600">Order cancelled, no payout, {naira(Number(d.amount) || 0)} refunded through Monnify straight away.</span>
          </label>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why you decided this" className={`${inputCls} mt-3 resize-none`} />
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        <button className={`${btn.dark} mt-3`} disabled={busy || !choice || note.trim().length < 5} onClick={decide}>{busy ? 'Saving...' : 'Save decision'}</button>
      </Card>
    );
  }

  if (d.refund_status !== 'pending') return null;

  const retry = async () => {
    if (!d.order_id) return;
    setBusy(true);
    setError('');
    try {
      const o = await moderationService.refundOrder(d.order_id, `Dispute ${d.order_ref}: ${d.resolution_note}`.slice(0, 900));
      if (o.refund_result?.status === 'failed') setError(o.refund_result.message);
      update(await disputesService.staffGet(d.id));
    } catch (e) {
      setError(errMsg(e, 'Could not retry the refund.'));
    } finally {
      setBusy(false);
    }
  };
  const record = async () => {
    if (!reference.trim()) return;
    setBusy(true);
    setError('');
    try {
      update(await disputesService.markRefunded(d.id, reference.trim()));
    } catch (e) {
      setError(errMsg(e, 'Could not record the refund.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-ink">Refund {naira(Number(d.amount) || 0)} to {d.customer_name}</h3>
      {pay?.refund_status === 'processing' && <p className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Sent to Monnify, waiting for confirmation (reference {pay.refund_reference}).</p>}
      {pay?.refund_status === 'failed' && <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">The automatic refund failed: {pay.refund_failure_reason}</p>}
      {pay?.refund_status !== 'processing' && (
        <>
          <button className={`${btn.dark} mt-3`} disabled={busy} onClick={retry}>{busy ? 'Working...' : 'Try the automatic refund again'}</button>
          <p className="mt-3 text-xs text-slate-600">Or refund by hand (for example a card payment Monnify cannot refund), then enter its reference. The customer is emailed when you save.</p>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Refund or transfer reference" className={`${inputCls} mt-2`} />
          <button className={`${btn.primary} mt-3`} disabled={busy || !reference.trim()} onClick={record}>{busy ? 'Saving...' : 'Record refund'}</button>
        </>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </Card>
  );
}

/* --------------------------------------------------------------- page */

export default function StaffDisputePage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setD(await disputesService.staffGet(id));
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Could not load this dispute.'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!d, topics: ['staff:dispute', 'staff:support'] });

  if (error) return <ErrorBox message={error} onRetry={() => load()} />;
  if (!d) return <Spinner />;
  const pay = d.payment;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/staff-panel/disputes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Disputes</Link>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-ink">Dispute on order #{d.order_ref}</h1>
            <p className="text-xs text-slate-600">{d.category_label} · opened {fmtDate(d.created_at)} · {d.customer_name} ({d.customer_email}) vs {d.vendor_name}</p>
          </div>
          <DisputeBadge dispute={d} viewer="staff" />
        </div>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">{d.reason}</p>
        {d.status === 'resolved' && <p className="mt-2 text-[13px] text-slate-700"><span className="font-bold text-ink">Decision ({d.resolution}):</span> {d.resolution_note}</p>}
        {d.order && (
          <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-700 sm:grid-cols-2">
            <div>{d.order.items.map((i, n) => <p key={n}>{i.quantity} x {i.title}</p>)}</div>
            <div className="sm:text-right">
              <p className="font-bold text-ink">{naira(Number(d.order.total) || 0)}</p>
              {pay && <p>payment {pay.status} · payout {pay.payout_status.replace('_', ' ')} · refund {pay.refund_status || 'none'}</p>}
              {d.order.delivered_at && <p>delivered {fmtDate(d.order.delivered_at)}</p>}
            </div>
          </div>
        )}
      </Card>

      <AskPanel d={d} update={setD} />
      <ResolvePanel d={d} update={setD} />
    </div>
  );
}
