'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { supportApi } from '@/lib/api/endpoints/support';
import type * as S from '@/lib/api/openapi-types';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { TicketStatus } from './SupportCenter';
import { SUPPORT_MAX_FILES, SUPPORT_TYPES, apiErrorText, checkSupportFiles } from './files';

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** One support request and its conversation, from the customer's (or vendor's) side. */
/** `embedded`: shown inside another page (a dispute), so no back link and no header card. */
export default function TicketThread({ id, backHref, embedded = false }: { id: string; backHref: string; embedded?: boolean }) {
  const [t, setT] = useState<S.SupportTicketDetail | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setT(await supportApi.ticketsRetrieve(id));
      setError('');
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 404 ? 'Request not found.' : 'Could not load this request.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!t && !sending, topics: ['support'] });

  const count = t?.messages.length ?? 0;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const pick = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])];
    const err = checkSupportFiles(next);
    setSendError(err);
    if (!err) setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      const fd = new FormData();
      fd.append('message', body.trim());
      files.forEach((f) => fd.append('files', f));
      await supportApi.ticketsReplyCreate(id, fd);
      setBody('');
      setFiles([]);
      await load();
    } catch (e) {
      setSendError(apiErrorText(e, 'Could not send. Try again.'));
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Support</Link>
        <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!t) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>;

  const closed = ['resolved', 'closed', 'rejected'].includes(t.status ?? '');

  return (
    <div className="space-y-5">
      {!embedded && <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Support</Link>}

      <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 ${embedded ? 'hidden' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{t.reference}</p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-ink">{t.subject}</h2>
            <p className="text-xs text-slate-600">{t.category} · opened {when(t.created_at)}</p>
          </div>
          <TicketStatus status={t.status} />
        </div>
      </div>

      <div className="space-y-3">
        {t.messages.map((m) => (
          <div key={m.id} className={`flex ${m.is_staff ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.is_staff ? 'border border-slate-200 bg-white' : 'bg-ink text-white'}`}>
              <p className={`text-[11px] font-bold ${m.is_staff ? 'text-[#FA3728]' : 'text-white/70'}`}>{m.is_staff ? 'ShopSafeNG support' : 'You'}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
              {m.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.attachments.map((a) =>
                    a.signed_url ? (
                      <a key={a.id} href={a.signed_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 text-xs font-semibold underline ${m.is_staff ? 'text-ink' : 'text-white'}`}>
                        <FileText size={13} /> {a.filename || 'Attachment'}
                      </a>
                    ) : (
                      <span key={a.id} className="flex items-center gap-1.5 text-xs opacity-70"><FileText size={13} /> {a.filename || 'Attachment'} (unavailable)</span>
                    )
                  )}
                </div>
              )}
              <p className={`mt-1 text-[10px] ${m.is_staff ? 'text-slate-500' : 'text-white/60'}`}>{when(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {closed ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-sm text-slate-600">
          This request is closed. Need more help? <Link href={backHref} className="font-semibold text-ink underline">Open a new request</Link>.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={10000} placeholder="Write a reply" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm" />
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink">
                  <span className="max-w-[10rem] truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, n) => n !== i))} aria-label={`Remove ${f.name}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-200"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          {sendError && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{sendError}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={files.length >= SUPPORT_MAX_FILES} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50">
              <Paperclip size={14} /> Attach
            </button>
            <input ref={fileRef} type="file" multiple accept={SUPPORT_TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files)} />
            <button type="button" onClick={send} disabled={sending || !body.trim()} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-[13px] font-bold text-white hover:bg-[#FA3728] disabled:opacity-50">
              {sending && <Loader2 size={14} className="animate-spin" />} Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
