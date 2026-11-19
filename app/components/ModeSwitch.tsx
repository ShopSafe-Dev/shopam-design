'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingBag, Store } from 'lucide-react';
import { setMode, homeFor } from '@/lib/auth/mode';
import { useMode } from '@/lib/auth/useMode';

/**
 * Customer / Vendor toggle with a sliding pill. Renders only for accounts that can act as both.
 * `compact` shows icons only (top bars); the default shows icon + label.
 */
export default function ModeSwitch({ onSwitched, compact = false }: { onSwitched?: () => void; compact?: boolean }) {
  const router = useRouter();
  const { mode, canSwitch } = useMode();
  const group = useId();
  if (!canSwitch || (mode !== 'vendor' && mode !== 'customer')) return null;

  const pick = (m: 'vendor' | 'customer') => {
    if (m === mode) return;
    setMode(m);
    router.push(homeFor(m));
    onSwitched?.();
  };

  const seg = (m: 'vendor' | 'customer', label: string, Icon: typeof Store) => {
    const active = mode === m;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={`${label} mode`}
        onClick={() => pick(m)}
        className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full font-bold transition-colors ${
          compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
        } ${active ? 'text-white' : 'text-slate-600 hover:text-ink'}`}
      >
        {active && (
          <motion.span
            layoutId={`mode-pill-${group}`}
            className="absolute inset-0 rounded-full bg-[#FA3728] shadow-md shadow-[#FA3728]/30"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <Icon size={compact ? 13 : 14} />
          {label}
        </span>
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Account mode"
      className="flex gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200/80"
    >
      {seg('customer', 'Customer', ShoppingBag)}
      {seg('vendor', 'Vendor', Store)}
    </div>
  );
}
