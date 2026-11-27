import { timeAgo } from '@/lib/format';

/** A product tagged on a post. */
export interface PostProduct {
  id: string;
  title: string;
  price: string;
  image: string | null;
  inStock: boolean;
  /** Variants or add-ons: the buyer has to choose, so the card opens the product page. */
  hasOptions: boolean;
}

/** Normalized post view-model shared by the Feed and vendor shop pages. */
export interface FeedPost {
  /** Post UUID. Curated fallback posts use ids starting with "demo-" and never call the API. */
  id: string;
  vendorName: string;
  /** The vendor's USER id (chat recipient). Missing on the curated fallback posts. */
  vendorUserId?: string;
  verified: boolean;
  followers?: number;
  timeAgo: string;
  /** ISO timestamp from the API. */
  createdAt?: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  tags: string[];
  isLiked?: boolean;
  isSaved?: boolean;
  shares?: number;
  /** Id of MY like on this post (to unlike). */
  myLikeId?: string | null;
  /** VendorProfile id, the target of follow. */
  vendorProfileId?: string | null;
  isFollowing?: boolean;
  myFollowId?: string | null;
  /** Products the vendor tagged on this post. */
  products?: PostProduct[];
}

export const isDemoPost = (p: { id: string }) => p.id.startsWith('demo-');

/** Map an API `Post` into the normalized feed view-model. */
export function toFeedPost(raw: any): FeedPost {
  const vendor = raw?.vendor ?? {};
  const name =
    raw?.vendor_name ||
    vendor?.business_name ||
    [vendor?.first_name, vendor?.last_name].filter(Boolean).join(' ') ||
    vendor?.username ||
    'ShopSafeNG vendor';
  const media = Array.isArray(raw?.media) ? raw.media : [];
  const first = media[0];
  const image = typeof first === 'string' ? first : first?.image_url || first?.url || '';

  return {
    id: String(raw?.id ?? ''),
    vendorName: name,
    vendorUserId: typeof vendor?.id === 'string' ? vendor.id : undefined,
    verified: Boolean(vendor?.is_verified ?? vendor?.is_vendor ?? false),
    followers: undefined,
    timeAgo: raw?.created_at ? timeAgo(raw.created_at) : '',
    createdAt: raw?.created_at ?? undefined,
    image,
    caption: raw?.caption ?? '',
    likes: Number(raw?.likes_count) || 0,
    comments: Number(raw?.comments_count) || 0,
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    isLiked: Boolean(raw?.is_liked),
    isSaved: false,
    shares: Number(raw?.shares_count) || 0,
    myLikeId: raw?.my_like_id ?? null,
    vendorProfileId: raw?.vendor_profile_id ?? null,
    isFollowing: Boolean(raw?.is_following_vendor),
    myFollowId: raw?.my_follow_id ?? null,
    products: Array.isArray(raw?.products)
      ? raw.products.map((p: any) => ({
          id: String(p.id),
          title: String(p.title ?? ''),
          price: String(p.price ?? '0'),
          image: typeof p.image === 'string' ? p.image : null,
          inStock: p.in_stock !== false,
          hasOptions: !!p.has_options,
        }))
      : [],
  };
}
