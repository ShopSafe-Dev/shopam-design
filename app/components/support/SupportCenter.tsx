'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Paperclip, Plus, X } from 'lucide-react';
import { supportApi } from '@/lib/api/endpoints/support';
import type * as S from '@/lib/api/openapi-types';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { SUPPORT_MAX_FILES, SUPPORT_TYPES, apiErrorText, checkSupportFiles } from './files';

export const SUPPORT_CATEGORIES = [
  'Order or delivery',
  'Payment or refund',
  'My account',
  'Selling on ShopSafeNG',
  'Report a user or listing',
  'Something else',
];

const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'bg-blue-50 text-blue-700' },
  pending: { label: 'Waiting for you', tone: 'bg-amber-50 text-amber-800' },
  resolved: { label: 'Resolved', tone: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Closed', tone: 'bg-slate-100 text-slate-600' },
  closed: { label: 'Closed', tone: 'bg-slate-100 text-slate-600' },
};

export function TicketStatus({ status }: { status?: string }) {
  const s = STATUS[status ?? 'open'] ?? STATUS.open;
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.tone}`}>{s.label}</span>;
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function NewTicketForm({ hrefBase, onCancel }: { hrefBase: string; onCancel: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])];
    const err = checkSupportFiles(next);
    setError(err);
    if (!err) setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!subject.trim() || !message.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('category', category);
      fd.append('message', message.trim());
      files.forEach((f) => fd.append('files', f));
      const t = await supportApi.ticketsCreate(fd);
      router.push(`${hrefBase}/${t.id}`);
    } catch (e) {
      setError(apiErrorText(e, 'Could not send your request. Try again.'));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">New request</h3>
        <button onClick={onCancel} aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={16} /></button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Topic</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm">
          {SUPPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} placeholder="A short summary" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">How can we help?</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={10000} placeholder="Include the order number if it is about an order" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm" />
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink">
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, n) => n !== i))} aria-label={`Remove ${f.name}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-200"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={files.length >= SUPPORT_MAX_FILES} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50">
          <Paperclip size={14} /> Attach files
        </button>
        <input ref={fileRef} type="file" multiple accept={SUPPORT_TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files)} />
        <button type="button" onClick={submit} disabled={busy || !subject.trim() || !message.trim()} className="flex items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#E31B23] disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />} Send
        </button>
      </div>
      <p className="text-[11px] text-slate-500">PDF, PNG or JPG, up to {SUPPORT_MAX_FILES} files. We reply here and by email.</p>
    </div>
  );
}

/** "My support requests": list + new request. Used on /support (customers) and /dashboard/support (vendors). */
export default function SupportCenter({ hrefBase }: { hrefBase: string }) {
  const [tickets, setTickets] = useState<S.SupportTicketList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const raw = (await supportApi.ticketsList({ page_size: 50 })) as unknown;
      const list = Array.isArray(raw) ? raw : ((raw as { results?: S.SupportTicketList[] }).results ?? []);
      setTickets(list as S.SupportTicketList[]);
      setError('');
    } catch {
      if (!silent) setError('Could not load your requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: !loading, topics: ['support'] });

  return (
    <div className="space-y-4">
      {composing ? (
        <NewTicketForm hrefBase={hrefBase} onCancel={() => setComposing(false)} />
      ) : (
        <button onClick={() => setComposing(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-4 text-sm font-bold text-ink hover:border-ink">
          <Plus size={16} /> New request
        </button>
      )}

      <section>
        <h3 className="mb-2 text-sm font-bold text-ink">Your requests</h3>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>
        ) : error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">{error} <button onClick={() => load()} className="ml-2 font-semibold underline">Retry</button></p>
        ) : tickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">No requests yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            {tickets.map((t) => (
              <Link key={t.id} href={`${hrefBase}/${t.id}`} className="block border-b border-slate-50 px-4 py-3.5 last:border-0 hover:bg-slate-50/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-bold text-ink">{t.subject}</p>
                  <TicketStatus status={t.status} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600">{t.reference} · {t.category} · {when(t.last_activity_at ?? t.created_at)}</p>
                {t.last_message?.body && <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{t.last_message.body}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
