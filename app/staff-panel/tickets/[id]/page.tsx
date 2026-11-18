'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { staffApi } from '@/lib/api/endpoints/staff';
import type * as S from '@/lib/api/openapi-types';
import { asList, Badge, Card, ErrorBox, PRIORITY_TONE, STATUS_TONE, Spinner, btn, errMsg, fmtDate, inputCls } from '../../ui';

const STATUSES: S.AdminTicketUpdateRequestStatusEnum[] = ['open', 'pending', 'resolved', 'rejected', 'closed'];
const MAX_FILES = 3;

export default function StaffTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<S.SupportTicketList | null>(null);
  const [messages, setMessages] = useState<S.TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      // There is no staff "get one ticket" endpoint: read the header from the list.
      const [rawList, rawMsgs] = await Promise.all([staffApi.ticketsList(), staffApi.ticketsMessagesList(id)]);
      const list = asList<S.SupportTicketList>(rawList);
      const msgs = asList<S.TicketMessage>(rawMsgs);
      const t = list.find((x) => x.id === id) ?? null;
      setTicket(t);
      if (t?.status) setStatus(t.status);
      setMessages(msgs);
    } catch (err) {
      setError(errMsg(err, 'Could not load this ticket.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveUpdate = async () => {
    setUpdating(true);
    setUpdateMsg('');
    try {
      const patch: S.PatchedAdminTicketUpdateRequestRequest = {};
      if (status && status !== ticket?.status) patch.status = status as S.AdminTicketUpdateRequestStatusEnum;
      if (assignee.trim()) patch.assigned_to = assignee.trim();
      if (!patch.status && !patch.assigned_to) {
        setUpdateMsg('Nothing to change.');
        return;
      }
      const updated = await staffApi.ticketsUpdatePartialUpdate(id, patch);
      setTicket((t) => (t ? { ...t, status: updated.status ?? t.status } : t));
      setAssignee('');
      setUpdateMsg('Saved.');
    } catch (err) {
      setUpdateMsg(errMsg(err, 'Could not update the ticket.'));
    } finally {
      setUpdating(false);
    }
  };

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      await staffApi.ticketsReplyCreate(id, { message: body.trim(), is_internal_note: internal, files });
      setBody('');
      setInternal(false);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
      setMessages(asList<S.TicketMessage>(await staffApi.ticketsMessagesList(id)));
    } catch (err) {
      setSendError(errMsg(err, 'Could not send the reply.'));
    } finally {
      setSending(false);
    }
  };

  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length > MAX_FILES) {
      setSendError(`Attach at most ${MAX_FILES} files (PDF, PNG or JPG).`);
      return;
    }
    setSendError('');
    setFiles(picked);
  };

  if (loading) return <Spinner />;

  return (
    <>
      <Link href="/staff-panel/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink">
        <ArrowLeft size={15} /> All tickets
      </Link>

      {error && <ErrorBox message={error} onRetry={load} />}

      {ticket && (
        <Card className="mb-4 p-4">
          <p className="font-mono text-xs text-slate-500">{ticket.reference}</p>
          <h1 className="mt-0.5 text-lg font-bold text-ink">{ticket.subject}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{ticket.category}</Badge>
            {ticket.priority && <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>}
            {ticket.status && <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-600">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} mt-1`}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Assign to (staff user ID)
              <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="optional" className={`${inputCls} mt-1`} />
            </label>
            <button onClick={saveUpdate} disabled={updating} className={btn.dark}>
              {updating && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
          {updateMsg && <p className="mt-2 text-xs text-slate-600">{updateMsg}</p>}
        </Card>
      )}

      <div className="space-y-3">
        {messages.map((m) => (
          <Card
            key={m.id}
            className={`p-4 ${m.is_internal_note ? '!border-amber-200 !bg-amber-50' : m.is_staff ? '!border-blue-100 !bg-blue-50/40' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-ink">
                {m.is_staff ? 'Staff' : m.sender_email || 'Customer'}
                {m.is_internal_note && <span className="ml-2"><Badge tone="amber">internal note</Badge></span>}
                {m.is_from_email && <span className="ml-2"><Badge>via email</Badge></span>}
              </span>
              <span>{fmtDate(m.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
            {m.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.attachments.map((a) =>
                  a.signed_url ? (
                    <a key={a.id} href={a.signed_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-slate-200 hover:bg-slate-50">
                      {a.filename || 'Attachment'}
                    </a>
                  ) : (
                    <span key={a.id} className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-200">{a.filename || 'Attachment'}</span>
                  )
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-5 p-4">
        <h2 className="mb-2 text-sm font-bold text-ink">Reply</h2>
        {sendError && <div className="mb-3"><ErrorBox message={sendError} /></div>}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write your reply…" className={inputCls} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (customer will not see it)
            </label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => pickFiles(e.target.files)}
              className="text-xs"
            />
          </div>
          <button onClick={send} disabled={!body.trim() || sending} className={btn.primary}>
            {sending && <Loader2 size={14} className="animate-spin" />} {internal ? 'Add note' : 'Send reply'}
          </button>
        </div>
      </Card>
    </>
  );
}
