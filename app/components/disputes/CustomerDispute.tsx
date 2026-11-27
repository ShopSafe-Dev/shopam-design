'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { disputesService, type DisputeDetail } from '@/lib/api/disputes';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { money } from '@/lib/order-steps';
import TicketThread from '@/app/components/support/TicketThread';
import DisputeBadge from './DisputeBadge';

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** The customer's dispute: where it stands, the decision, and their private conversation with ShopSafeNG. */
export default function CustomerDispute({ id }: { id: string }) {
  const [d, setD] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setD(await disputesService.get(id));
      setError('');
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 404 ? 'Dispute not found.' : 'Could not load this dispute.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!d, topics: ['dispute', 'order'] });

  if (error) return <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error}</p>;
  if (!d) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>;

  const status =
    d.status === 'open'
      ? 'The order is on hold and the seller has not been paid. Our team is reviewing it and will talk to you below.'
      : d.resolution === 'customer'
        ? d.refund_status === 'refunded'
          ? `Decided in your favour. You have been refunded${d.refund_reference ? ` (reference ${d.refund_reference})` : ''}.`
          : 'Decided in your favour. The order is cancelled and your refund is on its way.'
        : 'Decided in the seller’s favour. The payment goes to the seller.';

  return (
    <div className="space-y-5">
      <Link href="/disputes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Disputes</Link>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-ink">Order #{d.order_ref}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{d.category_label} · {d.vendor_name} · opened {when(d.created_at)}</p>
          </div>
          <DisputeBadge dispute={d} viewer="customer" />
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">{status}</p>
        {d.status === 'resolved' && d.resolution_note && <p className="mt-2 text-[13px] text-slate-700"><span className="font-bold text-ink">Note:</span> {d.resolution_note}</p>}
        {d.order && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-[13px] text-slate-700">
            {d.order.items.map((i, n) => <p key={n}>{i.quantity} x {i.title}</p>)}
            <p className="mt-1 font-bold text-ink">{money(Number(d.order.total) || 0)}</p>
          </div>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-sm font-bold text-ink">Your conversation with ShopSafeNG</h3>
        <p className="mb-3 text-xs text-slate-600">Only you and our team can see this.</p>
        {d.ticket_id ? (
          <TicketThread id={d.ticket_id} backHref="/support" embedded />
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
            No conversation yet. <Link href="/support" className="font-semibold underline">Contact support</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
