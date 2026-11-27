'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { analyticsApi } from '@/lib/api/endpoints/analytics';
import { ordersService, vendorsService } from '@/lib/api';
import type { Order } from '@/lib/api';
import { compactNumber } from '@/lib/format';
import { money } from '@/lib/order-steps';
import { useEarnings } from '@/lib/vendor/useEarnings';
import { useMyPosts } from '@/lib/vendor/useMyPosts';
import { engagement } from '@/lib/vendor/postStats';

type Tab = 'sales' | 'social' | 'products';
const TABS: { id: Tab; label: string }[] = [
  { id: 'sales', label: 'Sales and money' },
  { id: 'social', label: 'Social' },
  { id: 'products', label: 'Products' },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <p className="text-2xl font-black tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {note && <p className="mt-0.5 text-[11px] text-slate-600">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Vertical bars, one per item. Plain CSS, readable by screen readers through the title and aria-label. */
function Columns({ items, format }: { items: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Bar chart">
      {items.map((i) => (
        <div key={i.label} className="group relative flex h-full flex-1 items-end" title={`${i.label}: ${format(i.value)}`}>
          <div className={`w-full rounded-t ${i.value > 0 ? 'bg-[#FA3728]' : 'bg-slate-100'}`} style={{ height: `${Math.max(i.value > 0 ? 4 : 2, (i.value / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function Rows({ items, format }: { items: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-semibold text-ink">{i.label}</span>
            <span className="shrink-0 font-bold text-ink">{format(i.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#FA3728]" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          {i.sub && <p className="mt-0.5 text-[11px] text-slate-600">{i.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

const Spin = () => <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STATUS_LABEL: Record<string, string> = {
  pending_vendor_review: 'New request',
  pending_customer_approval: 'Changes sent',
  awaiting_shipping_details: 'Awaiting details',
  shipping_set: 'Fee set',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  disputed: 'Disputed',
  completed: 'Completed',
  cancelled: 'Declined or cancelled',
};

/* ------------------------------------------------------------------ Sales */

function SalesTab() {
  const { earnings, loading, error } = useEarnings(200);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    ordersService.getVendorOrders().then((r) => { setOrders(r.results); setOrderCount(r.count ?? r.results.length); }).catch(() => {});
  }, []);

  const daily = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const byDay = new Map<string, number>();
    (earnings?.transactions ?? []).forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime())) byDay.set(dayKey(d), (byDay.get(dayKey(d)) ?? 0) + t.amount);
    });
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: byDay.get(dayKey(d)) ?? 0 });
    }
    return days;
  }, [earnings]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o) => m.set(o.status, (m.get(o.status) ?? 0) + 1));
    return [...m.entries()].map(([s, n]) => ({ label: STATUS_LABEL[s] ?? s, value: n })).sort((a, b) => b.value - a.value);
  }, [orders]);

  if (loading) return <Spin />;
  if (error || !earnings) return <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error || 'Could not load your earnings.'}</p>;

  const avg = earnings.orders > 0 ? earnings.total / earnings.orders : 0;
  const last30 = daily.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total earned" value={money(earnings.total)} />
        <Tile label="Paid to your bank" value={money(earnings.paid_out)} />
        <Tile label="On the way" value={money(earnings.on_the_way)} />
        <Tile label="Average per paid order" value={money(avg)} hint={`${earnings.orders} paid order${earnings.orders === 1 ? '' : 's'}`} />
      </div>
      <Panel title="Earned each day, last 30 days" note={`${money(last30)} in this period. Based on your latest ${earnings.transactions.length} paid orders.`}>
        <Columns items={daily} format={money} />
        <div className="mt-2 flex justify-between text-[11px] text-slate-600"><span>{daily[0]?.label}</span><span>{daily[daily.length - 1]?.label}</span></div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Orders by stage" note={`${orderCount} order${orderCount === 1 ? '' : 's'} in total${orders.length < orderCount ? `, latest ${orders.length} shown` : ''}.`}>
          {byStatus.length === 0 ? <p className="text-sm text-slate-600">No orders yet.</p> : <Rows items={byStatus} format={(n) => String(n)} />}
        </Panel>
        <Panel title="Platform fees" note="Commission taken on paid orders.">
          <p className="text-2xl font-black text-ink">{money(earnings.platform_fees)}</p>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Social */

function SocialTab() {
  const mine = useMyPosts(50);
  const [followers, setFollowers] = useState<number | null>(null);
  const profileId = mine.posts.find((p) => p.vendorProfileId)?.vendorProfileId ?? null;

  useEffect(() => {
    if (!profileId) return;
    vendorsService.getVendor(profileId).then((v) => setFollowers(v.followers)).catch(() => {});
  }, [profileId]);

  const totals = useMemo(() => mine.posts.reduce((t, p) => ({ likes: t.likes + p.likes, comments: t.comments + p.comments, shares: t.shares + (p.shares ?? 0) }), { likes: 0, comments: 0, shares: 0 }), [mine.posts]);
  const top = useMemo(() => [...mine.posts].sort((a, b) => engagement(b) - engagement(a)).slice(0, 6).filter((p) => engagement(p) > 0), [mine.posts]);

  if (mine.loading) return <Spin />;
  if (mine.error) return <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{mine.error}</p>;

  const n = mine.posts.length;
  const avg = n ? (totals.likes + totals.comments + totals.shares) / n : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Followers" value={followers === null ? '...' : compactNumber(followers)} />
        <Tile label="Posts" value={String(mine.total)} />
        <Tile label="Likes" value={compactNumber(totals.likes)} />
        <Tile label="Comments" value={compactNumber(totals.comments)} />
        <Tile label="Shares" value={compactNumber(totals.shares)} />
        <Tile label="Engagement per post" value={avg.toFixed(1)} hint="Likes + comments + shares" />
      </div>
      <Panel title="Your best posts" note={mine.hasMore ? `Out of your latest ${n} posts.` : undefined}>
        {top.length === 0 ? (
          <p className="text-sm text-slate-600">{n === 0 ? 'You have not posted yet.' : 'No likes, comments or shares yet.'}</p>
        ) : (
          <Rows items={top.map((p) => ({ label: p.caption || 'Photo post', value: engagement(p), sub: `${p.likes} likes, ${p.comments} comments, ${p.shares ?? 0} shares · ${p.timeAgo}` }))} format={(v) => String(v)} />
        )}
      </Panel>
      <p className="text-[11px] text-slate-600">Views and reach are not tracked yet, so post results are likes, comments and shares.</p>
    </div>
  );
}

/* --------------------------------------------------------------- Products */

type Period = '7d' | '30d' | '90d' | '12m';
interface ProductRow { name: string; views: number; cartAdds: number; units: number; revenue: number }

const asNum = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0')); return Number.isFinite(n) ? n : 0; };

/** The spec does not publish this response, so read it defensively: an array under a common key, common field names. */
function parseProducts(res: unknown): ProductRow[] {
  const r = res as Record<string, unknown> | unknown[] | null;
  const list = Array.isArray(r) ? r : Array.isArray((r as Record<string, unknown> | null)?.results) ? (r as { results: unknown[] }).results : Array.isArray((r as Record<string, unknown> | null)?.products) ? (r as { products: unknown[] }).products : Array.isArray((r as Record<string, unknown> | null)?.items) ? (r as { items: unknown[] }).items : [];
  return list
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      name: String(x.title ?? x.name ?? x.product_name ?? x.product ?? 'Product'),
      views: asNum(x.views),
      cartAdds: asNum(x.cart_adds),
      units: asNum(x.units),
      revenue: asNum(x.revenue),
    }));
}

function ProductsTab() {
  const [period, setPeriod] = useState<Period>('30d');
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setRows(null);
    setError('');
    try {
      setRows(parseProducts(await analyticsApi.vendorProductsRetrieve({ period, ordering: 'revenue', limit: 20 })));
    } catch {
      setError('Could not load product analytics.');
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period" className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 outline-none focus:border-ink sm:text-xs">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="12m">Last 12 months</option>
        </select>
      </div>
      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error} <button onClick={load} className="ml-2 font-semibold underline">Retry</button></p>
      ) : rows === null ? (
        <Spin />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-600">No product activity in this period yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              <tr><th className="px-4 py-3">Product</th><th className="px-3 py-3 text-right">Views</th><th className="px-3 py-3 text-right">Added to cart</th><th className="px-3 py-3 text-right">Sold</th><th className="px-4 py-3 text-right">Revenue</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-b border-slate-50 last:border-0">
                  <td className="max-w-[16rem] truncate px-4 py-3 font-semibold text-ink">{r.name}</td>
                  <td className="px-3 py-3 text-right">{compactNumber(r.views)}</td>
                  <td className="px-3 py-3 text-right">{compactNumber(r.cartAdds)}</td>
                  <td className="px-3 py-3 text-right">{compactNumber(r.units)}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Page */

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('sales');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'sales' || t === 'social' || t === 'products') setTab(t);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Analytics</h2>
        <p className="mt-0.5 text-sm text-slate-600">How your money, your posts and your products are doing.</p>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-slate-200/70 no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => choose(t.id)} className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-bold transition-colors ${tab === t.id ? 'border-[#FA3728] text-ink' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && <SalesTab />}
      {tab === 'social' && <SocialTab />}
      {tab === 'products' && <ProductsTab />}
    </div>
  );
}
