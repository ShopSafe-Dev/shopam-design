'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { disputesService, type DisputeDetail, type DisputeRole } from '@/lib/api/disputes';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { money } from '@/lib/order-steps';
import DisputeBadge from './DisputeBadge';

const MAX_FILES = 5;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const ROLE_STYLE: Record<DisputeRole, string> = {
  customer: 'bg-white border-slate-200',
  vendor: 'bg-slate-50 border-slate-200',
  staff: 'bg-blue-50 border-blue-100',
};

const ROLE_LABEL: Record<DisputeRole, string> = { customer: 'Customer', vendor: 'Vendor', staff: 'ShopSafeNG' };

/** What this viewer should know right now, in one sentence. */
function guidance(d: DisputeDetail): string {
  const r = d.viewer_role;
  if (d.status === 'open') {
    if (r === 'vendor' && d.awaiting === 'vendor') return 'The customer is waiting for your side. Explain what happened and add photos if you have them. Your payout is paused until this is decided.';
    if (r === 'customer' && d.awaiting === 'vendor') return 'We have asked the vendor to respond. Your money stays with ShopSafeNG until this is decided.';
    if (r === 'staff') return d.awaiting === 'vendor' ? 'The vendor has not answered yet.' : 'Both sides have spoken. Read the thread and decide.';
    return 'ShopSafeNG is reviewing both sides. We may ask you a question here.';
  }
  if (d.resolution === 'customer') {
    if (d.refund_status === 'pending') return r === 'staff' ? 'Send the refund, then record its reference below.' : 'Resolved in favour of the customer. The refund is being arranged.';
    return `Resolved in favour of the customer. Refunded${d.refund_reference && r !== 'vendor' ? ` (reference ${d.refund_reference})` : ''}.`;
  }
  return 'Resolved in favour of the vendor. The payout continues as normal.';
}

export default function DisputeThread({
  id,
  backHref,
  staffPanel,
}: {
  id: string;
  backHref: string;
  /** Staff-only controls (resolve, record refund). Receives the dispute and a setter for the updated copy. */
  staffPanel?: (d: DisputeDetail, update: (d: DisputeDetail) => void) => React.ReactNode;
}) {
  const [d, setD] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<'all' | 'staff' | 'customer' | 'vendor'>('all');
  const [sendError, setSendError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setD(await disputesService.get(id));
      setError('');
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 404 ? 'Dispute not found.' : 'Could not load this dispute.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load, { enabled: !!d && !sending, topics: ['dispute', 'staff:dispute'] });

  const count = d?.messages.length ?? 0;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const pick = (list: FileList | null) => {
    setSendError('');
    const picked = Array.from(list ?? []);
    if (picked.some((f) => !TYPES.includes(f.type))) return setSendError('Photos must be JPEG, PNG or WebP.');
    if (picked.some((f) => f.size > 10 * 1024 * 1024)) return setSendError('Each photo must be 10 MB or smaller.');
    setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    if ((!body.trim() && files.length === 0) || sending) return;
    setSending(true);
    setSendError('');
    try {
      await disputesService.reply(id, body.trim(), files, audience);
      setBody('');
      setFiles([]);
      await load();
    } catch (e) {
      const data = (e as { response?: { data?: Record<string, unknown> } }).response?.data;
      const first = data && (Object.values(data).flat()[0] as string | undefined);
      setSendError(typeof first === 'string' ? first : 'Could not send. Try again.');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Disputes</Link>
        <p className="rounded-2xl bg-red-50 px-4 py-6 text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!d) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink" /></div>;

  return (
    <div className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink"><ArrowLeft size={15} /> Disputes</Link>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-ink">Dispute on order #{d.order_ref}</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {d.category_label} · opened {when(d.created_at)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {d.customer_name}{d.customer_email ? ` (${d.customer_email})` : ''} vs {d.vendor_name}
            </p>
          </div>
          <DisputeBadge dispute={d} viewer={d.viewer_role} />
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">{guidance(d)}</p>
        {d.status === 'resolved' && d.resolution_note && (
          <p className="mt-2 text-[13px] text-slate-700"><span className="font-bold text-ink">Decision note:</span> {d.resolution_note}</p>
        )}
      </div>

      {d.order && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-ink">Order</h3>
            <span className="text-sm font-black text-ink">{money(Number(d.order.total) || 0)}</span>
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
            {d.order.items.map((i, n) => <li key={n}>{i.quantity} x {i.title}</li>)}
          </ul>
          {d.order.delivered_at && <p className="mt-2 text-xs text-slate-600">Delivered {when(d.order.delivered_at)}</p>}
        </div>
      )}

      {staffPanel && d.viewer_role === 'staff' && staffPanel(d, setD)}

      <section>
        <h3 className="mb-3 text-sm font-bold text-ink">Conversation</h3>
        <div className="space-y-3">
          {d.messages.map((m) => (
            <div key={m.id} className={`rounded-2xl border p-3.5 ${ROLE_STYLE[m.role]}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-ink">
                  {m.role === 'staff' ? 'ShopSafeNG' : m.sender_name || ROLE_LABEL[m.role]}
                  <span className="ml-1.5 text-[11px] font-semibold text-slate-500">{ROLE_LABEL[m.role]}</span>
                </p>
                <span className="text-[11px] text-slate-500">{when(m.created_at)}</span>
              </div>
              {m.visible_to && (
                <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {d.viewer_role === 'staff' ? `Private with the ${m.visible_to}` : 'Private: only you and ShopSafeNG see this'}
                </p>
              )}
              {m.body && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{m.body}</p>}
              {m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </section>

      {d.can_reply ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={d.viewer_role === 'staff' ? 'Ask a question or note something both sides should see' : 'Add details or answer a question'}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm"
          />
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
          {d.viewer_role === 'staff' ? (
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
              Who sees this
              <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                <option value="all">Both sides</option>
                <option value="customer">Only the customer (private)</option>
                <option value="vendor">Only the vendor (private)</option>
              </select>
            </label>
          ) : (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={audience === 'staff'} onChange={(e) => setAudience(e.target.checked ? 'staff' : 'all')} />
              Only ShopSafeNG can see this (the {d.viewer_role === 'customer' ? 'vendor' : 'customer'} will not)
            </label>
          )}
          {sendError && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{sendError}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50">
              <ImagePlus size={15} /> Add photos
            </button>
            <input ref={fileRef} type="file" multiple accept={TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files)} />
            <button type="button" onClick={send} disabled={sending || (!body.trim() && files.length === 0)} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-[13px] font-bold text-white hover:bg-[#FA3728] disabled:opacity-50">
              {sending && <Loader2 size={14} className="animate-spin" />} Send
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-600">This dispute is closed. For anything else, contact support.</p>
      )}
    </div>
  );
}
