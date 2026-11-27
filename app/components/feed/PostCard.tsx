'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, Check, UserPlus } from 'lucide-react';
import { compactNumber } from '@/lib/format';
import { feedApi, isAuthError } from '@/lib/feed/api';
import { useUser } from '@/lib/auth/useUser';
import { isDemoPost, type FeedPost } from './data';
import CommentsSheet from './CommentsSheet';
import PostProducts from './PostProducts';
import { reportPostView } from '@/lib/analytics/events';

/**
 * Shared post card used by the Feed and the vendor shop "Posts" tab.
 * Keeps its own like / save / expand state.
 */
export default function PostCard({ post, index = 0 }: { post: FeedPost; index?: number }) {
  const [liked, setLiked] = useState(!!post.isLiked);
  const [saved, setSaved] = useState(!!post.isSaved);
  const [expanded, setExpanded] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [likeId, setLikeId] = useState<string | null>(post.myLikeId ?? null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shares, setShares] = useState(post.shares ?? 0);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(!!post.isFollowing);
  const [followId, setFollowId] = useState<string | null>(post.myFollowId ?? null);
  const [followBusy, setFollowBusy] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const demo = isDemoPost(post);
  const isOwn = !!user && !!post.vendorUserId && user.id === post.vendorUserId;

  const needSignIn = () => router.push(`/auth/signin?redirect=${encodeURIComponent('/feed')}`);

  /** Optimistic: the heart flips at once and is rolled back if the server says no. */
  const toggleLike = async () => {
    if (demo) {
      setLikes((n) => (liked ? n - 1 : n + 1));
      setLiked((v) => !v);
      return;
    }
    if (!user) return needSignIn();
    if (likeBusy) return;
    setLikeBusy(true);
    const wasLiked = liked;
    const prevId = likeId;
    setLiked(!wasLiked);
    setLikes((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    try {
      if (wasLiked) {
        if (prevId) await feedApi.unlike(prevId);
        setLikeId(null);
      } else {
        setLikeId(await feedApi.like(post.id));
      }
    } catch (e) {
      setLiked(wasLiked);
      setLikes((n) => Math.max(0, n + (wasLiked ? 1 : -1)));
      if (isAuthError(e)) needSignIn();
    } finally {
      setLikeBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!post.vendorProfileId) return;
    if (!user) return needSignIn();
    if (followBusy) return;
    setFollowBusy(true);
    const was = following;
    setFollowing(!was);
    try {
      if (was) {
        if (followId) await feedApi.unfollow(followId);
        setFollowId(null);
      } else {
        setFollowId(await feedApi.follow(post.vendorProfileId));
      }
    } catch (e) {
      setFollowing(was);
      if (isAuthError(e)) needSignIn();
    } finally {
      setFollowBusy(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${vendorHref}`;
    try {
      if (navigator.share) await navigator.share({ title: post.vendorName, text: post.caption.slice(0, 120), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      return; // the person closed the share sheet
    }
    if (!demo && user) feedApi.share(post.id).then(setShares).catch(() => {});
  };

  // The shop page is keyed by VendorProfile id (the name only worked with the old demo data).
  const vendorHref = post.vendorProfileId ? `/vendors/${encodeURIComponent(post.vendorProfileId)}` : '/vendors';

  // Count a view when at least half the post stays on screen for a second (not for the author).
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || demo || isOwn || typeof IntersectionObserver === 'undefined') return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) t = setTimeout(() => { reportPostView(post.id); io.disconnect(); }, 1000);
        else if (t) clearTimeout(t);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      if (t) clearTimeout(t);
      io.disconnect();
    };
  }, [post.id, demo, isOwn]);

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.4 }}
      className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      {/* Header — vendor • date */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <Link href={vendorHref} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FA3728] to-[#E31B23] ring-1 ring-slate-900/5">
            <span className="text-sm font-bold text-white">{post.vendorName[0]}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-ink">{post.vendorName}</h3>
              {post.verified && (
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-trust text-[8px] font-bold text-white">
                  ✓
                </span>
              )}
              {post.timeAgo && <span className="text-xs text-slate-400">· {post.timeAgo}</span>}
            </div>
            {typeof post.followers === 'number' && post.followers > 0 && (
              <p className="text-[11px] text-slate-400">
                {compactNumber(post.followers)} followers
              </p>
            )}
          </div>
        </Link>
        {!demo && !isOwn && post.vendorProfileId && (
          <button
            onClick={() => void toggleFollow()}
            disabled={followBusy}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              following ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-ink text-white hover:bg-[#FA3728]'
            }`}
          >
            {following ? <Check size={13} /> : <UserPlus size={13} />}
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Image — large rounded square */}
      <Link href={vendorHref} className="block px-3.5">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
          {post.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image}
              alt={`${post.vendorName} post`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300">
              <MessageCircle size={28} />
            </div>
          )}
        </div>
      </Link>

      {/* Actions + caption */}
      <div className="px-3.5 pb-3.5 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => void toggleLike()} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} className="group flex items-center gap-1.5">
              <Heart
                size={20}
                className={`transition-colors ${
                  liked ? 'fill-[#FA3728] text-[#FA3728]' : 'text-slate-700 group-hover:text-[#FA3728]'
                }`}
              />
              <span className="text-sm font-semibold text-ink">{likes}</span>
            </button>
            <button onClick={() => (demo ? undefined : setCommentsOpen(true))} className="group flex items-center gap-1.5" aria-label="Comments">
              <MessageCircle
                size={20}
                className="text-slate-700 transition-colors group-hover:text-[#FA3728]"
              />
              <span className="text-sm font-semibold text-ink">{comments}</span>
            </button>
            <button onClick={() => void share()} className="group flex items-center gap-1.5" aria-label="Share">
              <Share2
                size={20}
                className="text-slate-700 transition-colors group-hover:text-[#FA3728]"
              />
              {shares > 0 && <span className="text-sm font-semibold text-ink">{shares}</span>}
              {copied && <span className="text-[11px] font-semibold text-emerald-600">Link copied</span>}
            </button>
          </div>
          <button onClick={() => setSaved((v) => !v)} aria-label="Save">
            <Bookmark
              size={20}
              className={`transition-colors ${
                saved ? 'fill-[#FA3728] text-[#FA3728]' : 'text-slate-700 hover:text-[#FA3728]'
              }`}
            />
          </button>
        </div>

        {/* Caption */}
        <div className="mt-2.5 text-sm leading-relaxed text-slate-700">
          <Link href={vendorHref} className="font-bold text-ink">
            {post.vendorName}
          </Link>{' '}
          {expanded ? (
            <>
              {post.caption}{' '}
              {post.caption.length > 100 && (
                <button
                  onClick={() => setExpanded(false)}
                  className="font-medium text-slate-400 hover:text-slate-600"
                >
                  see less
                </button>
              )}
            </>
          ) : (
            <>
              {post.caption.length > 100 ? `${post.caption.substring(0, 100)}… ` : post.caption}
              {post.caption.length > 100 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="font-medium text-slate-400 hover:text-slate-600"
                >
                  more
                </button>
              )}
            </>
          )}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/explore?q=${encodeURIComponent(tag)}`}
                className="text-[11px] font-medium text-[#FA3728] hover:underline"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <PostProducts products={post.products ?? []} canAdd={!!user && !isOwn} />

        <div className="mt-3 border-t border-slate-100 pt-3">
          <Link
            href={post.vendorUserId ? `/chats/with/${post.vendorUserId}?name=${encodeURIComponent(post.vendorName)}` : vendorHref}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-50 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#FA3728] hover:text-white"
          >
            <MessageCircle size={16} />
            {post.vendorUserId ? 'Order via Chat' : 'View vendor'}
          </Link>
        </div>
      </div>
    {!demo && (
        <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCountChange={(d) => setComments((n) => Math.max(0, n + d))} />
      )}
    </motion.article>
  );
}
