'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { compactNumber } from '@/lib/format';
import { useMyPosts } from '@/lib/vendor/useMyPosts';
import { useVendorProfile } from '@/lib/vendor/useVendorProfile';
import { engagement } from '@/lib/vendor/postStats';
import type { FeedPost } from '@/app/components/feed/data';
import PostComposer from '../components/PostComposer';

type Sort = 'newest' | 'engagement' | 'likes' | 'comments' | 'shares';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'engagement', label: 'Most engagement' },
  { id: 'likes', label: 'Most likes' },
  { id: 'comments', label: 'Most comments' },
  { id: 'shares', label: 'Most shares' },
];

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <p className="text-2xl font-black tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{label}</p>
    </div>
  );
}

export default function PostsPage() {
  const { vendor } = useVendorProfile();
  const mine = useMyPosts(20);
  const [sort, setSort] = useState<Sort>('newest');
  // From a notification (/dashboard/posts?post=<id>): scroll to that post and highlight it.
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    setFocus(new URLSearchParams(window.location.search).get('post'));
  }, []);
  useEffect(() => {
    if (!focus || mine.loading) return;
    document.getElementById(`post-${focus}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus, mine.loading]);

  const totals = useMemo(
    () => mine.posts.reduce((t, p) => ({ likes: t.likes + p.likes, comments: t.comments + p.comments, shares: t.shares + (p.shares ?? 0) }), { likes: 0, comments: 0, shares: 0 }),
    [mine.posts]
  );

  const sorted = useMemo(() => {
    if (sort === 'newest') return mine.posts;
    const keys: Record<Exclude<Sort, 'newest'>, (p: FeedPost) => number> = {
      engagement,
      likes: (p) => p.likes,
      comments: (p) => p.comments,
      shares: (p) => p.shares ?? 0,
    };
    const key = keys[sort];
    return [...mine.posts].sort((a, b) => key(b) - key(a));
  }, [mine.posts, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-ink">Posts</h2>
          <p className="mt-0.5 text-sm text-slate-600">Write a post and see how each one is doing.</p>
        </div>
        <Link href="/dashboard/analytics?tab=posts" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#FA3728]">
          Post analytics <ArrowRight size={14} />
        </Link>
      </div>

      <PostComposer authorName={vendor?.name ?? ''} logo={vendor?.logo} onCreated={mine.prepend} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Posts" value={String(mine.total)} />
        <Tile label="Likes" value={compactNumber(totals.likes)} />
        <Tile label="Comments" value={compactNumber(totals.comments)} />
        <Tile label="Shares" value={compactNumber(totals.shares)} />
      </div>
      {mine.hasMore && <p className="-mt-3 text-[11px] text-slate-600">Totals cover the {mine.posts.length} posts loaded so far.</p>}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">All posts</h3>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort posts" className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 outline-none focus:border-ink sm:text-xs">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {mine.loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>
        ) : mine.error ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center">
            <p className="text-sm font-semibold text-ink">{mine.error}</p>
            <button onClick={mine.reload} className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-[#FA3728]">Try again</button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-600">No posts yet. Your first one goes in the box above.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            {sorted.map((p) => (
              <div key={p.id} id={`post-${p.id}`} className={`flex items-center gap-3 border-b border-slate-50 px-3 py-3 last:border-0 sm:gap-4 sm:px-4 ${focus === p.id ? 'bg-amber-50' : ''}`}>
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-semibold text-ink">{p.caption || 'Photo post'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{p.timeAgo}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1"><Heart size={13} /> {compactNumber(p.likes)}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={13} /> {compactNumber(p.comments)}</span>
                    <span className="flex items-center gap-1"><Share2 size={13} /> {compactNumber(p.shares ?? 0)}</span>
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-lg font-black text-ink">{compactNumber(engagement(p))}</p>
                  <p className="text-[11px] text-slate-600">engagement</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {mine.hasMore && !mine.loading && (
          <div className="mt-4 text-center">
            <button onClick={mine.loadMore} disabled={mine.loadingMore} className="rounded-full border border-slate-200 bg-white px-8 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60">
              {mine.loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
