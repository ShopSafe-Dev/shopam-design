'use client';

import { Banknote } from 'lucide-react';
import { money } from '@/lib/order-steps';
import type { Earnings } from '@/lib/api/earnings';

export default function BalanceCard({ earnings, loading }: { earnings: Earnings | null; loading?: boolean }) {
  const show = (n?: number) => (loading || !earnings ? '...' : money(n ?? 0));
  return (
    <div className="rounded-3xl bg-ink p-5 text-white sm:p-6">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-white/60">Total earnings</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
          <Banknote size={17} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{show(earnings?.total)}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        <div>
          <p className="text-[11px] text-white/60">Paid to your bank</p>
          <p className="mt-0.5 text-lg font-bold">{show(earnings?.paid_out)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/60">On the way</p>
          <p className="mt-0.5 text-lg font-bold">{show(earnings?.on_the_way)}</p>
        </div>
      </div>
    </div>
  );
}
