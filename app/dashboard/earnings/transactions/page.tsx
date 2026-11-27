'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TransactionRows from '../../components/TransactionRows';
import { useEarnings } from '@/lib/vendor/useEarnings';

export default function TransactionsPage() {
  const { earnings, loading, error } = useEarnings(200);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/earnings" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink">Transactions</h2>
          <p className="text-xs text-slate-600">Every paid order and where its payout stands.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <TransactionRows rows={earnings?.transactions ?? []} loading={loading} error={error} />
      </div>
    </div>
  );
}
