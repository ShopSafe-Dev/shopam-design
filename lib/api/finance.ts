import apiClient from './config';

export type PayoutBucket = 'overdue' | 'due' | 'not_due' | 'held' | 'in_progress' | 'paid_out' | 'refunded';

export const PAYOUT_BUCKETS: { id: PayoutBucket; label: string; hint: string }[] = [
  { id: 'overdue', label: 'Overdue', hint: 'Due more than a day ago and still not paid. The automatic payout did not manage these: pay them here.' },
  { id: 'due', label: 'Due', hint: 'Dispute window has passed. The hourly automatic payout should pay these soon.' },
  { id: 'not_due', label: 'Not yet due', hint: 'Paid by the customer and held in escrow: not delivered yet, or still inside the 7-day dispute window.' },
  { id: 'held', label: 'Held', hint: 'Cannot be paid: disputed, vendor suspended or deactivated, or no verified bank account.' },
  { id: 'in_progress', label: 'In progress', hint: 'Transfer sent to Monnify, waiting for confirmation.' },
  { id: 'paid_out', label: 'Paid out', hint: 'Monnify confirmed the transfer to the vendor.' },
  { id: 'refunded', label: 'Refunded', hint: 'The customer was refunded or the order cancelled. No payout.' },
];

export interface PayoutRow {
  order_id: string;
  order_ref: string;
  order_status: string;
  tx_ref: string;
  vendor_id: string | null;
  vendor_name: string;
  customer_email: string;
  amount_paid: string;
  vendor_payout: string;
  commission: string;
  vat: string;
  paid_at: string | null;
  delivered_at: string | null;
  due_at: string | null;
  payout_status: string;
  payout_attempts: number;
  payout_failure_reason: string;
  refund_status: string;
  reason: string;
  payable: boolean;
}

export interface PayoutQueue {
  count: number;
  next: string | null;
  previous: string | null;
  results: PayoutRow[];
  bucket: PayoutBucket;
  summary: Record<PayoutBucket, { count: number; vendor_payout_total: string }>;
}

export interface PayResult {
  order_id: string;
  ok: boolean;
  message: string;
}

export interface FinanceDay {
  date: string;
  orders: number;
  gmv: string;
  commission: string;
  vat: string;
  vendor_share: string;
  refunded: string;
  commission_refunded: string;
}

export interface FinanceSummary {
  days: number;
  totals: { commission: string; commission_refunded: string; commission_net: string; vat: string; gmv: string; refunded: string; orders: number };
  position: {
    escrow_vendor_share: string;
    escrow_commission: string;
    commission_earned_on_paid_out: string;
    vat_collected_all_time: string;
    paid_out_to_vendors: string;
  };
  series: FinanceDay[];
}

export interface VatMonth {
  period: string;
  transactions: number;
  vat: string;
  taxable: string;
  refunded_transactions: number;
  filed: boolean;
  filed_at: string | null;
  reference: string;
  filed_vat: string | null;
  changed_since_filing: boolean;
}

/** Fetch a file through the API client (the access token is not in a cookie) and hand it to the browser. */
async function download(url: string, params: Record<string, unknown>, filename: string): Promise<void> {
  const res = await apiClient.get<Blob>(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Staff finance: payout queue, ShopSafeNG's own revenue and VAT. Staff only. */
export const financeService = {
  async payouts(params: { bucket: PayoutBucket; q?: string; page?: number }): Promise<PayoutQueue> {
    return (await apiClient.get<PayoutQueue>('/api/payments/staff/finance/payouts', { params })).data;
  },

  /** Pay up to 20 due/overdue orders now. Every order gets its own result. */
  async pay(orderIds: string[]): Promise<PayResult[]> {
    return (await apiClient.post<{ results: PayResult[] }>('/api/payments/staff/finance/payouts/pay', { order_ids: orderIds })).data.results;
  },

  async summary(days: number): Promise<FinanceSummary> {
    return (await apiClient.get<FinanceSummary>('/api/payments/staff/finance/summary', { params: { days } })).data;
  },

  downloadSummary(days: number) {
    return download('/api/payments/staff/finance/summary.csv', { days }, `shopsafeng-revenue-last-${days}-days.csv`);
  },

  async vat(year: number): Promise<{ year: number; months: VatMonth[] }> {
    return (await apiClient.get<{ year: number; months: VatMonth[] }>('/api/payments/staff/finance/vat', { params: { year } })).data;
  },

  downloadVatSchedule(period: string) {
    return download(`/api/payments/staff/finance/vat/${encodeURIComponent(period)}/schedule.csv`, {}, `shopsafeng-vat-schedule-${period}.csv`);
  },

  async markVatFiled(period: string, reference: string, note = ''): Promise<void> {
    await apiClient.post(`/api/payments/staff/finance/vat/${encodeURIComponent(period)}/filed`, { reference, note });
  },
};
