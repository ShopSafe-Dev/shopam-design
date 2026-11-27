import { money } from '@/lib/order-steps';
import type { EarningTransaction } from '@/lib/api/earnings';

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function TransactionRows({ rows, loading, error }: { rows: EarningTransaction[]; loading: boolean; error?: string }) {
  if (loading) return <p className="px-4 py-6 text-sm text-slate-600">Loading...</p>;
  if (error) return <p className="px-4 py-6 text-sm text-red-600">{error}</p>;
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-slate-600">No transactions yet. Paid orders show up here.</p>;
  return (
    <>
      {rows.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 border-b border-slate-50 px-4 py-3.5 last:border-0">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{t.label}</p>
            <p className="text-[11px] text-slate-600">
              {when(t.date)}
              {t.failure_reason ? ` · ${t.failure_reason}` : ''}
            </p>
          </div>
          <span className={`shrink-0 text-[13px] font-bold ${t.payout_status === 'successful' ? 'text-emerald-600' : t.payout_status === 'failed' ? 'text-red-600' : 'text-slate-600'}`}>
            +{money(t.amount)}
          </span>
        </div>
      ))}
    </>
  );
}
