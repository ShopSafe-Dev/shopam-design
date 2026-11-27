'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsApi } from '@/lib/api/endpoints/analytics';
import { Card, ErrorBox, Spinner, PageHeader, errMsg, naira, inputCls } from './ui';

type Period = '7d' | '30d' | '90d' | '12m';

/** GET /api/analytics/staff/overview/ (analytics/queries.py platform_overview + top_vendors + top_products). */
interface Overview {
  period: { start: string; end: string; days: number };
  totals: {
    orders_placed: number;
    orders_paid: number;
    gross_sales: number;
    vat: number;
    platform_fee: number;
    revenue: number;
    earnings: number;
    items_sold: number;
    avg_order_value: number;
    conversion_rate: number | null;
    signups: number;
    new_vendors: number;
    disputes_opened: number;
    dispute_rate: number | null;
    product_views: number;
    cart_adds: number;
  };
  change_pct: { gmv: number | null; orders_paid: number | null; revenue: number | null };
  series: { date: string; orders: number; gmv: number; platform_fee: number; vat: number; signups: number; new_vendors: number; product_views: number }[];
  top_vendors: { vendor: string; business_name: string | null; orders: number; gross_sales: number; earnings: number; rating: number; reviews: number }[];
  top_products: { product: string; title: string; units_sold: number; revenue: number }[];
}

type SeriesKey = 'gmv' | 'orders' | 'platform_fee' | 'signups' | 'product_views';
const SERIES: { id: SeriesKey; label: string; money: boolean }[] = [
  { id: 'gmv', label: 'GMV', money: true },
  { id: 'orders', label: 'Paid orders', money: false },
  { id: 'platform_fee', label: 'Commission', money: true },
  { id: 'signups', label: 'Sign-ups', money: false },
  { id: 'product_views', label: 'Product views', money: false },
];

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-slate-500">no earlier data</span>;
  return <span className={`text-[11px] font-bold ${pct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{pct >= 0 ? '+' : ''}{pct}% vs previous</span>;
}

function Tile({ label, value, change, hint }: { label: string; value: string; change?: number | null; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
      {change !== undefined && <Change pct={change} />}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </Card>
  );
}

function Body({ data }: { data: Overview }) {
  const [series, setSeries] = useState<SeriesKey>('gmv');
  const t = data.totals;
  const def = SERIES.find((s) => s.id === series)!;
  const fmt = (n: number) => (def.money ? naira(n) : n.toLocaleString());
  const max = Math.max(1, ...data.series.map((d) => d[series]));
  const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="GMV (customers paid)" value={naira(t.gross_sales)} change={data.change_pct.gmv} />
        <Tile label="Commission revenue" value={naira(t.revenue)} change={data.change_pct.revenue} hint={`VAT held for filing: ${naira(t.vat)}`} />
        <Tile label="Paid orders" value={t.orders_paid.toLocaleString()} change={data.change_pct.orders_paid} hint={`Average ${naira(t.avg_order_value)}`} />
        <Tile label="Vendor earnings" value={naira(t.earnings)} />
        <Tile label="Sign-ups" value={t.signups.toLocaleString()} hint={`${t.new_vendors} new vendors`} />
        <Tile label="Conversion" value={t.conversion_rate === null ? '-' : `${t.conversion_rate}%`} hint={`${t.product_views.toLocaleString()} product views, ${t.cart_adds.toLocaleString()} cart adds`} />
        <Tile label="Disputes opened" value={t.disputes_opened.toLocaleString()} hint={t.dispute_rate === null ? undefined : `${t.dispute_rate}% of paid orders`} />
        <Tile label="Items sold" value={t.items_sold.toLocaleString()} />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {SERIES.map((s) => (
            <button key={s.id} onClick={() => setSeries(s.id)} className={`rounded-full px-3 py-1 text-xs font-bold ${series === s.id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700'}`}>{s.label}</button>
          ))}
        </div>
        <div className="flex h-44 items-end gap-[2px]" role="img" aria-label={`${def.label} per day`}>
          {data.series.map((d) => (
            <div key={d.date} className="flex h-full flex-1 items-end" title={`${day(d.date)}: ${fmt(d[series])}`}>
              <div className={`w-full rounded-t ${d[series] > 0 ? 'bg-[#FA3728]' : 'bg-slate-100'}`} style={{ height: `${Math.max(d[series] > 0 ? 4 : 2, (d[series] / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-600">
          <span>{day(data.period.start)}</span>
          <span>{day(data.period.end)}</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-ink">Top vendors</p>
          {data.top_vendors.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No sales in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="px-4 py-2">Shop</th><th className="px-3 py-2 text-right">Orders</th><th className="px-4 py-2 text-right">GMV</th></tr></thead>
              <tbody>
                {data.top_vendors.map((v) => (
                  <tr key={v.vendor} className="border-t border-slate-100">
                    <td className="px-4 py-2"><Link href={`/vendors/${v.vendor}`} className="font-semibold text-ink hover:underline">{v.business_name || 'Unnamed shop'}</Link></td>
                    <td className="px-3 py-2 text-right">{v.orders}</td>
                    <td className="px-4 py-2 text-right font-semibold">{naira(v.gross_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="overflow-x-auto">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-ink">Top products</p>
          {data.top_products.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No sales in this period.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="px-4 py-2">Product</th><th className="px-3 py-2 text-right">Sold</th><th className="px-4 py-2 text-right">Revenue</th></tr></thead>
              <tbody>
                {data.top_products.map((p) => (
                  <tr key={p.product} className="border-t border-slate-100">
                    <td className="max-w-[14rem] truncate px-4 py-2"><Link href={`/products/${p.product}`} className="font-semibold text-ink hover:underline">{p.title || 'Product'}</Link></td>
                    <td className="px-3 py-2 text-right">{p.units_sold}</td>
                    <td className="px-4 py-2 text-right font-semibold">{naira(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <p className="text-[11px] text-slate-500">Past days are totalled overnight; today is counted live.</p>
    </div>
  );
}

export default function StaffOverviewPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData((await analyticsApi.staffOverviewRetrieve({ period })) as unknown as Overview);
    } catch (err) {
      setError(errMsg(err, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Sales, commission, sign-ups and disputes across ShopSafeNG"
        action={
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={`${inputCls} !w-auto`} aria-label="Period">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
        }
      />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={() => load()} /> : data && data.totals ? <Body data={data} /> : null}
    </>
  );
}
