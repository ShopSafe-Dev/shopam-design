import { WifiOff } from 'lucide-react';
import type { Link } from '@/lib/chat/store';

/** Shown only when live updates are not flowing. Messages still send and refresh by polling. */
export default function ConnectionPill({ link }: { link: Link }) {
  if (link === 'open' || link === 'idle' || link === 'connecting') return null;
  const text =
    link === 'unavailable' ? 'Live updates are off. Refreshing every few seconds.' : 'Reconnecting. New messages may be delayed.';
  return (
    <div role="status" className="flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-medium text-amber-800">
      <WifiOff size={12} />
      {text}
    </div>
  );
}

export function LiveDot({ link }: { link: Link }) {
  const live = link === 'open';
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-500">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {live ? 'Live' : 'Offline'}
    </span>
  );
}

/** Same message as ConnectionPill, as a rounded card for list pages. */
export function ConnectionBanner({ link }: { link: Link }) {
  if (link === 'open' || link === 'idle' || link === 'connecting') return null;
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] font-medium text-amber-800">
      <WifiOff size={13} />
      {link === 'unavailable' ? 'Live updates are off. This list refreshes every few seconds.' : 'Reconnecting. New messages may be delayed.'}
    </div>
  );
}
