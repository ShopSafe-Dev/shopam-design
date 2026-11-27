import type { FeedPost } from '@/app/components/feed/data';

/** Likes + comments + shares. Views are not tracked yet, so this is the only reach-like number we have. */
export const engagement = (p: FeedPost): number => p.likes + p.comments + (p.shares ?? 0);
