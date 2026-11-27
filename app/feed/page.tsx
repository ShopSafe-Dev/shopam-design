'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Hash, ArrowRight, Loader2 } from 'lucide-react';
import { authService, postsService, productsService, vendorsService } from '@/lib/api';
import type { ProductService, Vendor } from '@/lib/api';
import AppHeader from '../components/AppHeader';
import PostCard from '../components/feed/PostCard';
import { toFeedPost, type FeedPost } from '../components/feed/data';
import BottomNav from '../components/BottomNav';

export default function FeedPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [newProducts, setNewProducts] = useState<ProductService[]>([]);

  useEffect(() => {
    setIsAuthenticated(!!authService.getCurrentUser());
    vendorsService.getVendors({ page_size: 5 }).then((r) => setVendors(r.results)).catch(() => {});
    productsService.getProducts({ page: 1, page_size: 4, ordering: '-created_at' }).then((r) => setNewProducts(r.results)).catch(() => {});
  }, []);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await postsService.getPosts({ page: p, page_size: 10 });
      const mapped = (res.results ?? []).map(toFeedPost);
      setPosts((prev) => (p === 1 ? mapped : [...prev, ...mapped]));
      setHasMore(!!res.next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(page);
  }, [page, loadPage]);

  const tabs = [{ id: 'for-you', label: 'For you', icon: Home }];
  const activeTab = 'for-you';

  const trendingTags = ['fashion', 'african', 'dress', 'tech', 'earbuds', 'food', 'beauty', 'books'];

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 pb-40 pt-6 sm:px-6 sm:pb-28 lg:px-8">
        {/* Accessible page heading — visibly redundant with the navbar */}
        <h1 className="sr-only">Feed</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)_200px] xl:grid-cols-[240px_minmax(0,1fr)_240px]">
          {/* Left rail — feed filters + trending tags */}
          <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-2">
              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                        active ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={17} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                Trending tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {trendingTags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-[#FA3728]/10 hover:text-[#FA3728]"
                  >
                    <Hash size={10} />
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* Center — the feed timeline */}
          <div className="mx-auto w-full max-w-xl">
            <div className="space-y-5">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </div>

            {loading && (
              <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>
            )}
            {!loading && failed && (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-200 py-14 text-center">
                <p className="text-base font-semibold text-ink">Could not load posts</p>
                <button onClick={() => void loadPage(page)} className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-[#FA3728]">Try again</button>
              </div>
            )}
            {!loading && !failed && posts.length === 0 && (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-200 py-14 text-center">
                <p className="text-base font-semibold text-ink">No posts yet</p>
                <p className="mt-1 text-sm text-slate-500">Posts from vendors will show up here.</p>
              </div>
            )}
            {!loading && hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-slate-200 bg-white px-8 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
                >
                  Load more posts
                </button>
              </div>
            )}
          </div>

          {/* Right rail — suggested vendors + trending products */}
          <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Suggested vendors
                </h2>
                <Link
                  href="/vendors"
                  className="text-[11px] font-bold text-ink transition-colors hover:text-[#FA3728]"
                >
                  See all
                </Link>
              </div>
              <div className="space-y-3">
                {vendors.map((vendor) => (
                  <Link
                    key={vendor.id}
                    href={`/vendors/${encodeURIComponent(vendor.id)}`}
                    className="group flex items-center gap-3"
                  >
                    {vendor.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vendor.avatar}
                        alt={vendor.name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-900/5"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-black text-white">{vendor.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-[#FA3728]">
                        {vendor.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{vendor.category}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  New products
                </h2>
                <Link
                  href="/explore"
                  className="text-[11px] font-bold text-ink transition-colors hover:text-[#FA3728]"
                >
                  See all
                </Link>
              </div>
              <div className="space-y-3">
                {newProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="group flex items-center gap-3"
                  >
                    {product.images?.[0]?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0].image_url}
                        alt={product.title}
                        className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-900/5"
                      />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-[#FA3728]">
                        {product.title}
                      </p>
                      <p className="truncate text-[11px] font-bold text-ink">
                        ₦{Number(product.price).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/chats"
              className="mt-4 flex items-center justify-between rounded-2xl bg-ink p-4 text-white transition-colors hover:bg-[#FA3728]"
            >
              <div>
                <p className="text-sm font-bold">Order via chat</p>
                <p className="text-[11px] text-white/70">Chat directly with vendors</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          </aside>
        </div>
      </main>

      {/* Sign Up prompt (only for signed-out visitors) */}
      {!isAuthenticated && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-3.5 backdrop-blur-xl sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">Join ShopSafeNG Today</p>
              <p className="text-xs text-slate-500">Like, comment, and shop</p>
            </div>
            <Link
              href="/auth/signup"
              className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
