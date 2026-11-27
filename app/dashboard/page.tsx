'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BarChart3, Inbox, Loader2 } from 'lucide-react';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { authService, ordersService, productsService } from '@/lib/api';
import type { Order, ProductService } from '@/lib/api';
import { money } from '@/lib/order-steps';
import { useEarnings } from '@/lib/vendor/useEarnings';
import { useMyPosts } from '@/lib/vendor/useMyPosts';
import { useVendorProfile } from '@/lib/vendor/useVendorProfile';
import PostCard from '@/app/components/feed/PostCard';
import PostComposer from './components/PostComposer';

const LOW_STOCK = 5;

/** Statuses where the vendor has to act (review, set shipping, ship). */
const NEEDS_ACTION = new Set(['pending_vendor_review', 'awaiting_shipping_details', 'paid']);

function statusLabel(s: string) {
  switch (s) {
    case 'pending_vendor_review': return 'New request';
    case 'awaiting_shipping_details': return 'Awaiting details';
    case 'paid': return 'Paid, ready to ship';
    default: return s;
  }
}

/** Lowest stock a product can sell: its variants when it has them, otherwise its own count. Null when unknown. */
function stockOf(p: ProductService): number | null {
  if (p.variants && p.variants.length > 0) {
    const counts = p.variants.map((v) => v.stock_quantity).filter((n): n is number => typeof n === 'number');
    return counts.length ? Math.min(...counts) : null;
  }
  return typeof p.stock_quantity === 'number' ? p.stock_quantity : null;
}

function Card({ title, href, cta, children }: { title: string; href?: string; cta?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#FA3728]">
            {cta} <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function VendorHomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [ready, setReady] = useState(false);
  const { earnings, loading: earningsLoading } = useEarnings(1);
  const { vendor } = useVendorProfile();
  const mine = useMyPosts(10);

  const load = useCallback(async () => {
    await Promise.all([
      ordersService.getVendorOrders().then((r) => setOrders(r.results)).catch(() => {}),
      productsService.getMyProducts().then((r) => setProducts(Array.isArray(r) ? r : [])).catch(() => {}),
    ]);
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { topics: ['order', 'product'] });

  const firstName = authService.getCurrentUser()?.first_name || 'Vendor';
  const needAction = useMemo(() => orders.filter((o) => NEEDS_ACTION.has(o.status)), [orders]);
  const restock = useMemo(
    () =>
      products
        .map((p) => ({ p, stock: stockOf(p) }))
        .filter((x): x is { p: ProductService; stock: number } => x.stock !== null && x.stock <= LOW_STOCK)
        .sort((a, b) => a.stock - b.stock),
    [products]
  );

  const summary = !ready
    ? 'Loading your shop...'
    : needAction.length > 0
      ? `${needAction.length} order${needAction.length === 1 ? ' needs' : 's need'} your attention.`
      : 'Nothing needs your attention right now.';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Welcome back, {firstName}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Your posts */}
        <div className="order-2 space-y-5 lg:order-1">
          <PostComposer authorName={vendor?.name ?? ''} logo={vendor?.logo} onCreated={mine.prepend} />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Your posts</h3>
            <Link href="/dashboard/posts" className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#FA3728]">
              Manage and see results <ArrowRight size={13} />
            </Link>
          </div>

          {mine.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>
          ) : mine.error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center">
              <p className="text-sm font-semibold text-ink">{mine.error}</p>
              <button onClick={mine.reload} className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-[#FA3728]">Try again</button>
            </div>
          ) : mine.posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <p className="text-sm font-bold text-ink">You have not posted yet</p>
              <p className="mt-1 text-xs text-slate-600">Write your first post above. Your followers see it in their feed.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {mine.posts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
              {mine.hasMore && (
                <div className="text-center">
                  <button onClick={mine.loadMore} disabled={mine.loadingMore} className="rounded-full border border-slate-200 bg-white px-8 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60">
                    {mine.loadingMore ? 'Loading...' : 'Load more posts'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* What needs you */}
        <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <Card title="Needs your action" href="/dashboard/orders" cta="All orders">
            {needAction.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600"><Inbox size={15} /> {ready ? 'All caught up.' : 'Loading...'}</p>
            ) : (
              <div>
                {needAction.slice(0, 4).map((o) => (
                  <Link key={o.id} href="/dashboard/orders" className="flex items-center justify-between gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50/60">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink">{o.customer_name || 'Buyer'}</p>
                      <p className="text-[11px] font-semibold text-[#FA3728]">{statusLabel(o.status)}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-ink">{money(Number(o.grand_total) || 0)}</span>
                  </Link>
                ))}
                {needAction.length > 4 && <p className="px-4 py-2 text-[11px] text-slate-600">and {needAction.length - 4} more</p>}
              </div>
            )}
          </Card>

          {restock.length > 0 && (
            <Card title="Low stock" href="/dashboard/products" cta="Manage">
              <div>
                {restock.slice(0, 4).map(({ p, stock }) => (
                  <Link key={p.id} href="/dashboard/products" className="flex items-center justify-between gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50/60">
                    <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink"><AlertTriangle size={13} className="shrink-0 text-amber-600" /><span className="truncate">{p.title}</span></p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-800'}`}>{stock === 0 ? 'Out' : `${stock} left`}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card title="Earnings" href="/dashboard/earnings" cta="Details">
            <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-2">
              <div>
                <p className="text-[11px] text-slate-600">Paid to your bank</p>
                <p className="text-lg font-black text-ink">{earningsLoading || !earnings ? '...' : money(earnings.paid_out)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-600">On the way</p>
                <p className="text-lg font-black text-ink">{earningsLoading || !earnings ? '...' : money(earnings.on_the_way)}</p>
              </div>
            </div>
          </Card>

          <Link href="/dashboard/analytics" className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink">
            <span className="flex items-center gap-2"><BarChart3 size={16} /> See how your shop is doing</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
