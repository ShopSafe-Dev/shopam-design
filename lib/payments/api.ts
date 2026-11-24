import apiClient from '@/lib/api/config';
import type { PrepareResult } from './monnify';

export const payApi = {
  /** Records the pending payment and returns what the modal needs. 409 wrong_step if the vendor has not sent the fee yet. */
  async prepare(orderId: string): Promise<PrepareResult> {
    return (await apiClient.post<PrepareResult>('/api/payments/checkout/prepare', { order_id: orderId })).data;
  },
  /** Fallback when the modal cannot load: Monnify's hosted page, opened in a new tab. */
  async hostedUrl(orderId: string): Promise<string> {
    return (await apiClient.post<{ checkout_url: string }>('/api/payments/checkout/init', { order_id: orderId })).data.checkout_url;
  },
};
