'use client';

import { useRouter } from 'next/navigation';
import { setMode, homeFor } from '@/lib/auth/mode';
import { useMode } from '@/lib/auth/useMode';

/** Vendor / Customer toggle. Renders only for accounts that can act as both. */
export default function ModeSwitch({ onSwitched }: { onSwitched?: () => void }) {
  const router = useRouter();
  const { mode, canSwitch } = useMode();
  if (!canSwitch || (mode !== 'vendor' && mode !== 'customer')) return null;

  const pick = (m: 'vendor' | 'customer') => {
    if (m === mode) return;
    setMode(m);
    router.push(homeFor(m));
    onSwitched?.();
  };

  const seg = (m: 'vendor' | 'customer', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => pick(m)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        mode === m ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-200/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div role="tablist" aria-label="Account mode" className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {seg('customer', 'Customer mode')}
      {seg('vendor', 'Vendor mode')}
    </div>
  );
}
