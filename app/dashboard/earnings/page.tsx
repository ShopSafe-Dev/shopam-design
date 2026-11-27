'use client';

import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import BalanceCard from '../components/BalanceCard';
import TransactionRows from '../components/TransactionRows';
import { useEarnings } from '@/lib/vendor/useEarnings';

export default function EarningsPage() {
  const { earnings, loading, error } = useEarnings(4);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Earnings</h2>
        <p className="mt-1 text-sm text-slate-600">Your balance and transactions.</p>
      </div>

      {/* Balance card */}
      <BalanceCard earnings={earnings} loading={loading} />

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FA3728]/10 text-[#FA3728]"><Zap size={15} /></span>
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-bold text-ink">Payouts are automatic.</span> When an order is completed, your earnings are settled to your bank account. There is nothing to withdraw.
        </p>
      </div>

      {/* Transaction preview */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Transaction history</h3>
          <Link href="/dashboard/earnings/transactions" className="flex items-center gap-1 text-xs font-semibold text-[#FA3728] hover:underline">
            See more <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <TransactionRows rows={earnings?.transactions ?? []} loading={loading} error={error} />
        </div>
      </section>

    </div>
  );
}
