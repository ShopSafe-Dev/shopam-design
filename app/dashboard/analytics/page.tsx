'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Star } from 'lucide-react';
import { compactNumber } from '@/lib/format';
import { money } from '@/lib/order-steps';
import { useEarnings } from '@/lib/vendor/useEarnings';
import { vendorAnalytics, type Period, type PostStat, type ProductStat, type VendorOverview } from '@/lib/api/vendorAnalytics';

type Tab = 'overview' | 'products' | 'posts' | 'money';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'posts', label: 'Posts' },
  { id: 'money', label: 'Money' },
];
const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
];

/* ------------------------------------------------------------------ pieces */

function Change({ pct }: { pct?: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-[11px] text-slate-500">no earlier data</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-emerald-700' : 'text-red-600'}`}>
      <Icon size={12} /> {Math.abs(pct)}% vs previous period
    </span>
  );
}

function Tile({ label, value, change, hint }: { label: string; value: string; change?: number | null; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <p className="text-2xl font-black tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{label}</p>
      {change !== undefined && <div className="mt-1"><Change pct={change} /></div>}
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

/** Vertical bars, one per day. Hover (or long-press) shows the value through the title. */
function Columns({ items, format }: { items: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`Daily values from ${items[0]?.label} to ${items[items.length - 1]?.label}`}>
        {items.map((i) => (
          <div key={i.label} className="flex h-full flex-1 items-end" title={`${i.label}: ${format(i.value)}`}>
            <div className={`w-full rounded-t ${i.value > 0 ? 'bg-[#FA3728]' : 'bg-slate-100'}`} style={{ height: `${Math.max(i.value > 0 ? 4 : 2, (i.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-600"><span>{items[0]?.label}</span><span>{items[items.length - 1]?.label}</span></div>
    </>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 1000) / 10 : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-ink">{s.label}</span>
              <span className="font-bold text-ink">
                {compactNumber(s.value)}
                {rate !== null && <span className="ml-1.5 text-[11px] font-semibold text-slate-500">{rate}% of previous step</span>}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#FA3728]" style={{ width: `${(s.value / top) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const Spin = () => <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>;
const Fail = ({ text, retry }: { text: string; retry: () => void }) => (
  <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{text} <button onClick={retry} className="ml-2 font-semibold underline">Retry</button></p>
);
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Fetch helper shared by the tabs: reloads when the period changes. */
function useData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setData(null);
    setError('');
    try {
      setData(await fetcher());
    } catch {
      setError('Could not load analytics.');
    }
  }, [fetcher]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, reload: load };
}

/* ------------------------------------------------------------------ tabs */

function OverviewTab({ period }: { period: Period }) {
  const fetcher = useCallback(() => vendorAnalytics.overview(period), [period]);
  const { data, error, reload } = useData<VendorOverview>(fetcher);
  const [series, setSeries] = useState<'sales' | 'orders' | 'product_views'>('sales');

  if (error) return <Fail text={error} retry={reload} />;
  if (!data) return <Spin />;
  const t = data.totals;
  const c = data.change_pct;
  const points = data.series.map((d) => ({ label: shortDay(d.date), value: d[series] }));
  const fmt = series === 'sales' ? money : (n: number) => compactNumber(n);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Sales (what customers paid)" value={money(t.gross_sales)} change={c.gross_sales} />
        <Tile label="Your earnings" value={money(t.earnings)} change={c.earnings} />
        <Tile label="Paid orders" value={compactNumber(t.orders_paid)} change={c.orders_paid} hint={`Average ${money(t.avg_order_value)}`} />
        <Tile label="Product views" value={compactNumber(t.product_views)} change={c.product_views} hint={`${compactNumber(t.unique_product_views)} different people`} />
      </div>

      <Panel title="Day by day">
        <div className="mb-3 flex flex-wrap gap-2">
          {([['sales', 'Sales'], ['orders', 'Paid orders'], ['product_views', 'Product views']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSeries(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${series === id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>
          ))}
        </div>
        <Columns items={points} format={fmt} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="From view to order" note={t.conversion_rate === null ? 'Conversion shows once your products get views.' : `${t.conversion_rate}% of people who viewed a product went on to pay.`}>
          <Funnel steps={[
            { label: 'Product views', value: data.funnel.product_views },
            { label: 'Added to cart', value: data.funnel.cart_adds },
            { label: 'Paid orders', value: data.funnel.orders_paid },
          ]} />
        </Panel>
        <Panel title="Your shop">
          <dl className="grid grid-cols-2 gap-4 text-[13px]">
            <div><dt className="text-slate-600">Followers</dt><dd className="text-lg font-black text-ink">{compactNumber(data.followers.total)}</dd><dd className="text-[11px] text-slate-500">+{data.followers.gained_in_period} this period</dd></div>
            <div><dt className="text-slate-600">Rating</dt><dd className="flex items-center gap-1 text-lg font-black text-ink"><Star size={15} className="fill-amber-400 text-amber-400" /> {data.rating.average.toFixed(1)}</dd><dd className="text-[11px] text-slate-500">{data.rating.count} reviews</dd></div>
            <div><dt className="text-slate-600">Shop page views</dt><dd className="text-lg font-black text-ink">{compactNumber(t.profile_views)}</dd><Change pct={c.profile_views} /></div>
            <div><dt className="text-slate-600">Post views</dt><dd className="text-lg font-black text-ink">{compactNumber(t.post_views)}</dd></div>
            <div><dt className="text-slate-600">Shares</dt><dd className="text-lg font-black text-ink">{compactNumber(t.shares)}</dd></div>
            <div><dt className="text-slate-600">Message taps</dt><dd className="text-lg font-black text-ink">{compactNumber(t.contact_clicks)}</dd></div>
          </dl>
        </Panel>
      </div>
      <p className="text-[11px] text-slate-600">Past days are totalled overnight; today is counted live. Views by you on your own shop are not counted.</p>
    </div>
  );
}

function ProductsTab({ period }: { period: Period }) {
  const [ordering, setOrdering] = useState<'revenue' | 'units' | 'views' | 'cart_adds' | 'rating'>('revenue');
  const fetcher = useCallback(() => vendorAnalytics.products(period, ordering), [period, ordering]);
  const { data, error, reload } = useData<ProductStat[]>(fetcher);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select value={ordering} onChange={(e) => setOrdering(e.target.value as typeof ordering)} aria-label="Sort products" className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 outline-none focus:border-ink sm:text-xs">
          <option value="revenue">Most revenue</option>
          <option value="units">Most sold</option>
          <option value="views">Most viewed</option>
          <option value="cart_adds">Most added to cart</option>
          <option value="rating">Best rated</option>
        </select>
      </div>
      {error ? <Fail text={error} retry={reload} /> : !data ? <Spin /> : data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-600">No products yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[40rem] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3 text-right">Views</th>
                <th className="px-3 py-3 text-right">In cart</th>
                <th className="px-3 py-3 text-right">Sold</th>
                <th className="px-3 py-3 text-right">Conversion</th>
                <th className="px-3 py-3 text-right">Rating</th>
                <th className="px-4 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.product} className="border-b border-slate-50 last:border-0">
                  <td className="max-w-[16rem] truncate px-4 py-3 font-semibold text-ink">{r.title}</td>
                  <td className="px-3 py-3 text-right" title={`${r.unique_views} different people`}>{compactNumber(r.views)}</td>
                  <td className="px-3 py-3 text-right">{compactNumber(r.cart_adds)}</td>
                  <td className="px-3 py-3 text-right">{compactNumber(r.units_sold)}</td>
                  <td className="px-3 py-3 text-right">{r.conversion_rate === null ? '-' : `${r.conversion_rate}%`}</td>
                  <td className="px-3 py-3 text-right">{r.reviews ? `${r.rating.toFixed(1)} (${r.reviews})` : '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-600">Revenue is unit price times quantity for paid orders, before VAT and delivery. Add-ons are not included.</p>
    </div>
  );
}

function PostsTab({ period }: { period: Period }) {
  const fetcher = useCallback(() => vendorAnalytics.posts(period), [period]);
  const { data, error, reload } = useData<PostStat[]>(fetcher);
  const totals = useMemo(
    () => (data ?? []).reduce((a, p) => ({ views: a.views + p.views, people: a.people + p.unique_views, likes: a.likes + p.likes, comments: a.comments + p.comments, shares: a.shares + p.shares }), { views: 0, people: 0, likes: 0, comments: 0, shares: 0 }),
    [data]
  );

  if (error) return <Fail text={error} retry={reload} />;
  if (!data) return <Spin />;
  if (data.length === 0) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-600">You have not posted yet.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Post views this period" value={compactNumber(totals.views)} hint={`${compactNumber(totals.people)} different people`} />
        <Tile label="Likes" value={compactNumber(totals.likes)} />
        <Tile label="Comments" value={compactNumber(totals.comments)} />
        <Tile label="Shares" value={compactNumber(totals.shares)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
        <table className="w-full min-w-[40rem] text-left text-[13px]">
          <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Post</th>
              <th className="px-3 py-3 text-right">Views</th>
              <th className="px-3 py-3 text-right">People</th>
              <th className="px-3 py-3 text-right">Likes</th>
              <th className="px-3 py-3 text-right">Comments</th>
              <th className="px-3 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.post} className="border-b border-slate-50 last:border-0">
                <td className="max-w-[18rem] px-4 py-3">
                  <p className="truncate font-semibold text-ink">{p.caption || 'Photo post'}</p>
                  <p className="text-[11px] text-slate-500">{new Date(p.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </td>
                <td className="px-3 py-3 text-right">{compactNumber(p.views)}</td>
                <td className="px-3 py-3 text-right">{compactNumber(p.unique_views)}</td>
                <td className="px-3 py-3 text-right">{compactNumber(p.likes)}</td>
                <td className="px-3 py-3 text-right">{compactNumber(p.comments)}</td>
                <td className="px-3 py-3 text-right">{compactNumber(p.shares)}</td>
                <td className="px-4 py-3 text-right font-bold text-ink">{p.engagement_rate === null ? '-' : `${p.engagement_rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        Views count posts seen in the feed or opened, once per person per day in &ldquo;People&rdquo;. Likes, comments and shares are all-time. Engagement is
        likes, comments and shares divided by the people who saw the post this period.
      </p>
    </div>
  );
}

function MoneyTab() {
  const { earnings, loading, error } = useEarnings(200);
  const daily = useMemo(() => {
    const byDay = new Map<string, number>();
    (earnings?.transactions ?? []).forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime())) byDay.set(d.toDateString(), (byDay.get(d.toDateString()) ?? 0) + t.amount);
    });
    const out: { label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: byDay.get(d.toDateString()) ?? 0 });
    }
    return out;
  }, [earnings]);

  if (loading) return <Spin />;
  if (error || !earnings) return <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error || 'Could not load your earnings.'}</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total earned" value={money(earnings.total)} />
        <Tile label="Paid to your bank" value={money(earnings.paid_out)} />
        <Tile label="On the way" value={money(earnings.on_the_way)} hint="Paid by customers, payout not confirmed yet" />
        <Tile label="Platform fees" value={money(earnings.platform_fees)} />
      </div>
      <Panel title="Earned each day, last 30 days" note={`From your latest ${earnings.transactions.length} paid orders, by the day the customer paid.`}>
        <Columns items={daily} format={money} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    if (t === 'social') setTab('posts'); // old links
    else if (TABS.some((x) => x.id === t)) setTab(t as Tab);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-ink">Analytics</h2>
          <p className="mt-0.5 text-sm text-slate-600">How your sales, products and posts are doing.</p>
        </div>
        {tab !== 'money' && (
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period" className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 outline-none focus:border-ink sm:text-xs">
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-slate-200/70 no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => choose(t.id)} className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-bold transition-colors ${tab === t.id ? 'border-[#FA3728] text-ink' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab period={period} />}
      {tab === 'products' && <ProductsTab period={period} />}
      {tab === 'posts' && <PostsTab period={period} />}
      {tab === 'money' && <MoneyTab />}
    </div>
  );
}
