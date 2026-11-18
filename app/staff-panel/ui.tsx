'use client';

import { Loader2 } from 'lucide-react';

/** Pull a readable message out of an axios/DRF error. */
export function errMsg(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string' && data && data.length < 300) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of ['message', 'detail', 'error']) if (typeof d[k] === 'string') return d[k] as string;
    const flat = Object.values(d).flat().filter((v) => typeof v === 'string');
    if (flat.length) return flat.join(' ');
  }
  if (!(err as { response?: unknown })?.response && err instanceof Error && err.message.startsWith('Unexpected response')) return err.message;
  return fallback;
}

export const httpStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '-');

export const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-60',
  dark: 'inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-slate-50 disabled:opacity-60',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60',
};

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200/80 bg-white ${className}`}>{children}</div>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin text-[#FA3728]" size={26} />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-12 text-center text-sm text-slate-500">{text}</div>;
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  open: 'blue',
  pending: 'amber',
  resolved: 'green',
  rejected: 'red',
  closed: 'slate',
};
export const PRIORITY_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  low: 'slate',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
};


/** Accept a bare array or a DRF page ({ results: [] }); anything else is an error. */
export function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const r = (raw as { results?: unknown; data?: unknown }).results ?? (raw as { data?: unknown }).data;
    if (Array.isArray(r)) return r as T[];
  }
  throw new Error('Unexpected response from the server (expected a list).');
}
