import type { DisputeSummary } from '@/lib/api/disputes';

/** One short line saying where a dispute stands, for the customer or for staff. */
export function disputeStage(d: Pick<DisputeSummary, 'status' | 'resolution' | 'refund_status'>, viewer: 'customer' | 'staff'): { text: string; tone: string } {
  if (d.status === 'open') {
    return viewer === 'staff'
      ? { text: 'Open', tone: 'bg-red-50 text-red-600' }
      : { text: 'Under review by ShopSafeNG', tone: 'bg-blue-50 text-blue-700' };
  }
  if (d.resolution === 'customer') {
    if (d.refund_status === 'pending') {
      return viewer === 'staff'
        ? { text: 'Refund to send', tone: 'bg-red-50 text-red-600' }
        : { text: 'Resolved for you, refund on its way', tone: 'bg-emerald-50 text-emerald-700' };
    }
    return { text: viewer === 'staff' ? 'Customer refunded' : 'Resolved for you, refunded', tone: 'bg-emerald-50 text-emerald-700' };
  }
  return { text: 'Resolved for the vendor', tone: 'bg-slate-100 text-slate-700' };
}

export default function DisputeBadge({ dispute, viewer }: { dispute: Pick<DisputeSummary, 'status' | 'resolution' | 'refund_status'>; viewer: 'customer' | 'staff' }) {
  const s = disputeStage(dispute, viewer);
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.tone}`}>{s.text}</span>;
}
