'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { financeService, type FinanceSummary } from '@/lib/api/finance';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { Card, ErrorBox, Spinner, btn, errMsg, naira } from '../ui';

const RANGES = [7, 30, 90, 365];
const num = (s: string | number | null | undefined) => Number(s) || 0;

function Stat({ label, value, note, strong = false }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${strong ? 'text-emerald-700' : 'text-ink'}`}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </Card>
  );
}

export default function EarningsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await financeService.summary(days));
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Could not load earnings.'));
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!data, interval: 60_000, push: false });

  const download = async () => {
    setDownloading(true);
    try {
      await financeService.downloadSummary(days);
    } catch (e) {
      setError(errMsg(e, 'Could not download the CSV.'));
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <ErrorBox message={error} onRetry={() => load()} />;
  if (!data) return <Spinner />;

  const t = data.totals;
  const p = data.position;
  const series = data.series;
  const net = series.map((d) => num(d.commission) - num(d.commission_refunded));
  const max = Math.max(1, ...net.map(Math.abs));
  const today = series[series.length - 1];
  const shown = hover !== null ? series[hover] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => { setDays(r); setData(null); }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${days === r ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {r === 365 ? '1 year' : `${r} days`}
            </button>
          ))}
        </div>
        <button className={btn.ghost} onClick={download} disabled={downloading}>
          <Download size={14} /> {downloading ? 'Preparing...' : 'Daily CSV'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Our commission (net)" value={naira(num(t.commission_net))} note={`${naira(num(t.commission))} earned, ${naira(num(t.commission_refunded))} lost to refunds`} strong />
        <Stat label="Today" value={naira(num(today?.commission) - num(today?.commission_refunded))} note={`${today?.orders ?? 0} paid orders`} />
        <Stat label="Sales (GMV)" value={naira(num(t.gmv))} note={`${t.orders} paid orders`} />
        <Stat label="VAT collected" value={naira(num(t.vat))} note="Owed to FIRS, not our money" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Commission per day</h3>
          <p className="text-xs text-slate-600">
            {shown
              ? `${new Date(shown.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}: ${naira(num(shown.commission) - num(shown.commission_refunded))} from ${shown.orders} orders`
              : 'Hover or tap a bar'}
          </p>
        </div>
        <div className="mt-4 flex h-40 items-end gap-px" onMouseLeave={() => setHover(null)}>
          {net.map((v, i) => (
            <button
              key={series[i].date}
              type="button"
              aria-label={`${series[i].date}: ${naira(v)}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-sm ${v < 0 ? 'bg-red-400' : hover === i ? 'bg-ink' : 'bg-[#FA3728]/80'}`}
                style={{ height: `${Math.max(v === 0 ? 0 : 2, (Math.abs(v) / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{series[0]?.date}</span>
          <span>{series[series.length - 1]?.date}</span>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-bold text-ink">Where the money is now</h3>
        <p className="mt-0.5 text-xs text-slate-600">All time, not just the range above.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ['Vendor money held in escrow', p.escrow_vendor_share],
            ['Our commission still in escrow', p.escrow_commission],
            ['Paid out to vendors', p.paid_out_to_vendors],
            ['Commission on paid-out orders (ours to keep)', p.commission_earned_on_paid_out],
            ['VAT collected (to remit)', p.vat_collected_all_time],
          ].map(([label, v]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-bold text-ink">{naira(num(v))}</dd>
            </div>
          ))}
        </dl>
        {num(t.refunded) > 0 && <p className="mt-3 text-xs text-slate-600">Refunded to customers in this range: {naira(num(t.refunded))}.</p>}
      </Card>
    </div>
  );
}
