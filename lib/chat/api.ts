import apiClient from '@/lib/api/config';
import type { ApiMsg } from './types';

export interface Page<T> {
  next?: string | null;
  results: T[];
}

export interface ConversationRow {
  key: string;
  order: string | null;
  order_ref: string | null;
  order_status: string | null;
  other_user: string;
  other_name: string;
  unread: number;
  last_message: ApiMsg;
}

/** Thin wrappers over /api/posts/messages/*. (The generated client predates the `order` parameter.) */
export const chatApi = {
  async thread(p: { order?: string; user_id?: string; cursor?: string }): Promise<Page<ApiMsg>> {
    const { data } = await apiClient.get<Page<ApiMsg> | ApiMsg[]>('/api/posts/messages/thread', { params: p });
    return Array.isArray(data) ? { results: data } : { results: data?.results ?? [], next: data?.next ?? null };
  },
  async conversations(): Promise<ConversationRow[]> {
    const { data } = await apiClient.get<ConversationRow[]>('/api/posts/messages/conversations');
    return Array.isArray(data) ? data : [];
  },
  async send(body: { order?: string | null; recipient?: string; content: string }): Promise<ApiMsg> {
    const payload: Record<string, unknown> = { content: body.content };
    if (body.order) payload.order = body.order;
    if (body.recipient) payload.recipient = body.recipient;
    return (await apiClient.post<ApiMsg>('/api/posts/messages', payload)).data;
  },
  async markRead(body: { order?: string | null; user_id?: string }): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (body.order) payload.order = body.order;
    else if (body.user_id) payload.user_id = body.user_id;
    await apiClient.post('/api/posts/messages/mark_thread_read', payload);
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/posts/messages/${encodeURIComponent(id)}`);
  },
  async edit(id: string, content: string): Promise<ApiMsg> {
    return (await apiClient.patch<ApiMsg>(`/api/posts/messages/${encodeURIComponent(id)}`, { content })).data;
  },
};
