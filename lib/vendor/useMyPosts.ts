'use client';

import { useCallback, useEffect, useState } from 'react';
import { postsService } from '@/lib/api';
import { toFeedPost, type FeedPost } from '@/app/components/feed/data';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';

/**
 * The signed-in vendor's own posts (GET /api/social/posts?mine=true), newest first, with load-more.
 * Refreshes in place when someone likes or comments (live topic "social").
 */
export function useMyPosts(pageSize = 12) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    (p: number) => postsService.getPosts({ mine: true, page: p, page_size: pageSize }),
    [pageSize]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPage(1);
      setPosts((res.results ?? []).map(toFeedPost));
      setHasMore(!!res.next);
      setTotal(res.count ?? (res.results ?? []).length);
      setPage(1);
    } catch {
      setError('Could not load your posts.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      const more = (res.results ?? []).map(toFeedPost);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setHasMore(!!res.next);
      setPage((n) => n + 1);
    } catch {
      /* keep what is shown; the button stays so the vendor can try again */
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, page]);

  /** Silent refresh of the first page: new counts show without a spinner or losing scroll position. */
  const refresh = useCallback(async () => {
    const res = await fetchPage(1);
    const fresh = (res.results ?? []).map(toFeedPost);
    setTotal(res.count ?? fresh.length);
    setPosts((prev) => {
      const ids = new Set(fresh.map((p) => p.id));
      const oldest = fresh.length ? Date.parse(fresh[fresh.length - 1].createdAt ?? '') : NaN;
      // Keep posts loaded by "load more" (older than this page); drop ones that vanished from the first page.
      const older = prev.filter((p) => !ids.has(p.id) && Number.isFinite(oldest) && Date.parse(p.createdAt ?? '') < oldest);
      return [...fresh, ...older];
    });
  }, [fetchPage]);

  useLiveRefresh(refresh, { enabled: !loading && !error, interval: 60_000, topics: ['social'] });

  const prepend = useCallback((post: FeedPost) => {
    setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
    setTotal((n) => n + 1);
  }, []);

  return { posts, total, loading, loadingMore, hasMore, error, reload: load, loadMore, prepend };
}
