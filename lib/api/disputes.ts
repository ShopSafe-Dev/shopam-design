import apiClient from './config';

export type DisputeCategory = 'damaged' | 'not_as_described' | 'wrong_item' | 'missing_items' | 'fake' | 'other';
export type DisputeRole = 'customer' | 'vendor' | 'staff';

export const DISPUTE_CATEGORIES: { id: DisputeCategory; label: string }[] = [
  { id: 'damaged', label: 'Item arrived damaged' },
  { id: 'not_as_described', label: 'Not as described' },
  { id: 'wrong_item', label: 'Wrong item' },
  { id: 'missing_items', label: 'Items missing' },
  { id: 'fake', label: 'Counterfeit or fake' },
  { id: 'other', label: 'Something else' },
];

export interface DisputeTicket {
  id: string;
  reference: string;
  party: 'customer' | 'vendor';
  status: string;
  subject: string;
  user_email: string;
  last_activity_at: string | null;
}

export interface DisputeSummary {
  id: string;
  order_id: string | null;
  order_ref: string;
  status: 'open' | 'resolved';
  category: DisputeCategory | '';
  category_label: string;
  reason: string;
  customer_name: string;
  vendor_name: string;
  created_at: string;
  resolved_at: string | null;
  resolution: '' | 'vendor' | 'customer';
  refund_status: '' | 'pending' | 'refunded';
  amount: string;
}

export interface DisputeDetail extends DisputeSummary {
  resolution_note: string;
  refunded_at: string | null;
  refund_reference?: string;
  order: {
    id: string;
    ref: string;
    status: string;
    total: string;
    delivered_at: string | null;
    items: { title: string; quantity: number }[];
  } | null;
  viewer_role: 'customer' | 'staff';
  /** Customer: their own support ticket for this dispute (the conversation with ShopSafeNG). */
  ticket_id?: string | null;
  // staff only
  customer_email?: string;
  vendor_email?: string;
  tickets?: DisputeTicket[];
  vendor_contacted?: boolean;
  payment?: import('./moderation').PaymentState | null;
  refund_result?: { status: string; message?: string } | null;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function form(fields: Record<string, string>, files: File[] = []): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  files.forEach((f) => fd.append('files', f));
  return fd;
}

/**
 * Disputes run through support tickets: raising one opens a ticket for the customer; staff decide whether to open
 * a separate ticket with the vendor. Neither side sees the other's ticket.
 */
export const disputesService = {
  /** Customer: raise a dispute on a delivered order. Files: PDF, PNG or JPG. */
  async raise(orderId: string, data: { category: DisputeCategory; reason: string; files?: File[] }): Promise<{ dispute_id: string; ticket_id: string }> {
    return (await apiClient.post<{ dispute_id: string; ticket_id: string }>(
      `/api/commerce/orders/${encodeURIComponent(orderId)}/dispute`,
      form({ category: data.category, reason: data.reason }, data.files)
    )).data;
  },

  async list(params: { status?: 'open' | 'resolved'; order?: string; page?: number } = {}): Promise<Page<DisputeSummary>> {
    return (await apiClient.get<Page<DisputeSummary>>('/api/commerce/disputes', { params })).data;
  },

  async get(id: string): Promise<DisputeDetail> {
    return (await apiClient.get<DisputeDetail>(`/api/commerce/disputes/${encodeURIComponent(id)}`)).data;
  },

  // ---- staff
  async staffList(params: { status?: 'open' | 'resolved' | 'refund_pending'; q?: string; page?: number } = {}): Promise<Page<DisputeSummary>> {
    return (await apiClient.get<Page<DisputeSummary>>('/api/commerce/staff/disputes', { params })).data;
  },

  async staffGet(id: string): Promise<DisputeDetail> {
    return (await apiClient.get<DisputeDetail>(`/api/commerce/staff/disputes/${encodeURIComponent(id)}`)).data;
  },

  /** Write to one party in their own ticket (opened first when needed). The other party never sees it. */
  async ask(id: string, party: 'customer' | 'vendor', message: string, files: File[] = []): Promise<DisputeDetail> {
    return (await apiClient.post<DisputeDetail>(`/api/commerce/staff/disputes/${encodeURIComponent(id)}/ask`, form({ party, message }, files))).data;
  },

  async resolve(id: string, resolution: 'vendor' | 'customer', note: string): Promise<DisputeDetail> {
    return (await apiClient.patch<DisputeDetail>(`/api/commerce/staff/disputes/${encodeURIComponent(id)}/resolve`, { resolution, note })).data;
  },

  async markRefunded(id: string, reference: string): Promise<DisputeDetail> {
    return (await apiClient.post<DisputeDetail>(`/api/commerce/staff/disputes/${encodeURIComponent(id)}/refunded`, { reference })).data;
  },
};
