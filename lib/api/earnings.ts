import apiClient from './config';

export interface EarningTransaction {
  id: string;
  label: string;
  amount: number;
  date: string;
  payout_status: 'successful' | 'pending' | 'failed' | 'not_started';
  failure_reason: string;
}

export interface Earnings {
  currency: string;
  /** paid_out + on_the_way */
  total: number;
  /** Transfers to your bank that Monnify confirmed. */
  paid_out: number;
  /** Customer paid, payout not confirmed yet. */
  on_the_way: number;
  platform_fees: number;
  orders: number;
  transactions: EarningTransaction[];
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export const earningsService = {
  /** Vendor earnings computed from the payment ledger. */
  async get(limit = 20): Promise<Earnings> {
    const { data } = await apiClient.get('/api/payments/vendor/earnings', { params: { limit } });
    return {
      currency: data.currency ?? 'NGN',
      total: num(data.total),
      paid_out: num(data.paid_out),
      on_the_way: num(data.on_the_way),
      platform_fees: num(data.platform_fees),
      orders: Number(data.orders) || 0,
      transactions: (data.transactions ?? []).map((t: Record<string, unknown>) => ({
        id: String(t.id),
        label: String(t.label ?? ''),
        amount: num(t.amount),
        date: String(t.date ?? ''),
        payout_status: (t.payout_status as EarningTransaction['payout_status']) ?? 'not_started',
        failure_reason: String(t.failure_reason ?? ''),
      })),
    };
  },
};
