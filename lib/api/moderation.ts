import apiClient from './config';

/** Staff tools: accounts (accounts/moderation.py) and orders (commerce/staff_orders.py). */
export interface AccountRow {
  user_id: string;
  email: string;
  name: string;
  phone: string;
  is_active: boolean;
  is_staff: boolean;
  deactivated_by_staff: boolean;
  staff_deactivated_at: string | null;
  staff_deactivation_reason: string;
  deleted_by_user: boolean;
  vendor_profile_id: string | null;
  business_name: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string;
}

export interface PaymentState {
  tx_ref: string;
  status: string;
  total: string;
  vendor_payout_amount: string;
  payout_status: string;
  refund_status: '' | 'processing' | 'refunded' | 'failed';
  refund_reference: string;
  refund_failure_reason: string;
  refunded_at: string | null;
  paid_at: string | null;
}

export interface StaffOrder {
  id: string;
  ref: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  total: string;
  items: { title: string; quantity: number }[];
  customer: { user_id: string | null; name: string; email: string; is_active: boolean | null };
  vendor: { profile_id: string | null; user_id: string | null; name: string; is_suspended: boolean; is_active: boolean | null };
  payment: PaymentState | null;
  can_refund: boolean;
  refund_blocked_reason: string;
  dispute: { id: string; status: string; resolution: string } | null;
  refund_result?: { status: string; message: string };
}

const p = encodeURIComponent;

export const moderationService = {
  async findAccounts(q: string): Promise<AccountRow[]> {
    return (await apiClient.get<{ results: AccountRow[] }>('/api/accounts/staff/accounts', { params: { q } })).data.results;
  },
  async suspend(profileId: string, reason: string): Promise<AccountRow> {
    return (await apiClient.post<AccountRow>(`/api/accounts/staff/vendors/${p(profileId)}/suspend`, { reason })).data;
  },
  async unsuspend(profileId: string): Promise<AccountRow> {
    return (await apiClient.post<AccountRow>(`/api/accounts/staff/vendors/${p(profileId)}/unsuspend`, {})).data;
  },
  async deactivate(userId: string, reason: string): Promise<AccountRow> {
    return (await apiClient.post<AccountRow>(`/api/accounts/staff/users/${p(userId)}/deactivate`, { reason })).data;
  },
  async reactivate(userId: string): Promise<AccountRow> {
    return (await apiClient.post<AccountRow>(`/api/accounts/staff/users/${p(userId)}/reactivate`, {})).data;
  },

  async findOrders(q: string): Promise<StaffOrder[]> {
    return (await apiClient.get<{ results: StaffOrder[] }>('/api/commerce/staff/orders', { params: { q } })).data.results;
  },
  async order(id: string): Promise<StaffOrder> {
    return (await apiClient.get<StaffOrder>(`/api/commerce/staff/orders/${p(id)}`)).data;
  },
  /** Cancel the order, stop its payout and refund the customer (or retry a failed refund). */
  async refundOrder(id: string, reason: string): Promise<StaffOrder> {
    return (await apiClient.post<StaffOrder>(`/api/commerce/staff/orders/${p(id)}/refund`, { reason })).data;
  },
};
