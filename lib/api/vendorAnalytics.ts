import apiClient from './config';

/** Typed client for /api/analytics/vendor/* (shapes from analytics/queries.py). */
export type Period = '7d' | '30d' | '90d' | '12m';

export interface OverviewTotals {
  orders_placed: number;
  orders_paid: number;
  gross_sales: number;
  vat: number;
  platform_fee: number;
  earnings: number;
  items_sold: number;
  avg_order_value: number;
  conversion_rate: number | null;
  profile_views: number;
  unique_profile_views: number;
  product_views: number;
  unique_product_views: number;
  post_views: number;
  cart_adds: number;
  shares: number;
  contact_clicks: number;
}

export interface VendorOverview {
  period: { start: string; end: string; days: number };
  totals: OverviewTotals;
  change_pct: Partial<Record<'orders_paid' | 'gross_sales' | 'earnings' | 'product_views' | 'profile_views', number | null>>;
  funnel: { product_views: number; cart_adds: number; orders_paid: number };
  series: { date: string; orders: number; sales: number; earnings: number; items: number; profile_views: number; product_views: number; cart_adds: number }[];
  balance: { in_escrow: number; paid_out: number };
  followers: { total: number; gained_in_period: number };
  rating: { average: number; count: number };
}

export interface ProductStat {
  product: string;
  title: string;
  views: number;
  unique_views: number;
  cart_adds: number;
  units_sold: number;
  revenue: number;
  conversion_rate: number | null;
  rating: number;
  reviews: number;
}

export interface PostStat {
  post: string;
  caption: string;
  created_at: string;
  views: number;
  unique_views: number;
  shares_in_period: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number | null;
}

export const vendorAnalytics = {
  async overview(period: Period): Promise<VendorOverview> {
    return (await apiClient.get<VendorOverview>('/api/analytics/vendor/overview/', { params: { period } })).data;
  },
  async products(period: Period, ordering: 'revenue' | 'units' | 'views' | 'cart_adds' | 'rating' = 'revenue'): Promise<ProductStat[]> {
    return (await apiClient.get<{ products: ProductStat[] }>('/api/analytics/vendor/products/', { params: { period, ordering, limit: 50 } })).data.products ?? [];
  },
  async posts(period: Period): Promise<PostStat[]> {
    return (await apiClient.get<{ posts: PostStat[] }>('/api/analytics/vendor/posts/', { params: { period, limit: 50 } })).data.posts ?? [];
  },
};
