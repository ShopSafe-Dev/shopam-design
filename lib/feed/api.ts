import apiClient from '@/lib/api/config';

/** Wrappers for the feed actions. Paths match the backend (social app). */
export interface FeedComment {
  id: string;
  post: string;
  comment: string;
  created_at: string;
  user: { id: string; username?: string; first_name?: string; last_name?: string; profile_pic?: string | null; is_vendor?: boolean };
}

interface Page<T> {
  results: T[];
  next?: string | null;
}

export const feedApi = {
  /** Returns the like id (needed to unlike). */
  async like(postId: string): Promise<string> {
    return (await apiClient.post<{ id: string }>('/api/sociallikes', { post: postId })).data.id;
  },
  async unlike(likeId: string): Promise<void> {
    await apiClient.delete(`/api/sociallikes/${encodeURIComponent(likeId)}`);
  },
  async comments(postId: string, page = 1): Promise<Page<FeedComment>> {
    const { data } = await apiClient.get<Page<FeedComment> | FeedComment[]>('/api/socialcomments', { params: { post: postId, page } });
    return Array.isArray(data) ? { results: data } : { results: data?.results ?? [], next: data?.next ?? null };
  },
  async addComment(postId: string, comment: string): Promise<FeedComment> {
    return (await apiClient.post<FeedComment>('/api/socialcomments', { post: postId, comment })).data;
  },
  async deleteComment(id: string): Promise<void> {
    await apiClient.delete(`/api/socialcomments/${encodeURIComponent(id)}`);
  },
  /** followed_vendor is the VendorProfile id. Returns the follow id (needed to unfollow). */
  async follow(vendorProfileId: string): Promise<string> {
    return (await apiClient.post<{ id: string }>('/api/socialfollows', { followed_vendor: vendorProfileId })).data.id;
  },
  async unfollow(followId: string): Promise<void> {
    await apiClient.delete(`/api/socialfollows/${encodeURIComponent(followId)}`);
  },
  async share(postId: string): Promise<number> {
    return (await apiClient.post<{ shares_count: number }>(`/api/posts/socialposts/${encodeURIComponent(postId)}/share`, {})).data.shares_count;
  },
};

export const isAuthError = (e: unknown): boolean => (e as { response?: { status?: number } })?.response?.status === 401;
export const errorText = (e: unknown, fallback: string): string => {
  const d = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const first = d && typeof d === 'object' ? Object.values(d)[0] : undefined;
  const msg = Array.isArray(first) ? first[0] : first;
  return typeof msg === 'string' ? msg : fallback;
};
