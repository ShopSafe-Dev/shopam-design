'use client';

import Link from 'next/link';
import { useState } from 'react';
import apiClient from '@/lib/api/config';
import { btn, errMsg, inputCls } from './ui';

/**
 * Start a private support conversation with one customer or vendor (POST /api/support/staff/tickets/start).
 * Only that person and staff see it; the other side of the order is never told.
 */
export default function AskPrivately({
  userId,
  email: fixedEmail,
  relatedTicket,
  defaultSubject = '',
  label = 'Ask someone privately',
}: {
  userId?: string;
  email?: string;
  relatedTicket?: string;
  defaultSubject?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ id: string; reference: string } | null>(null);

  if (!open) return <button className={btn.ghost} onClick={() => setOpen(true)}>{label}</button>;

  const send = async () => {
    if (!subject.trim() || !message.trim() || (!userId && !email.trim())) return;
    setBusy(true);
    setError('');
    try {
      const body: Record<string, string> = { subject: subject.trim(), message: message.trim() };
      if (userId) body.user_id = userId;
      else body.email = email.trim();
      if (relatedTicket) body.related_ticket = relatedTicket;
      const res = await apiClient.post<{ id: string; reference: string }>('/api/support/staff/tickets/start', body);
      setSent(res.data);
      setMessage('');
    } catch (e) {
      setError(errMsg(e, 'Could not send.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-600">Opens a private conversation with one person. They are emailed and can reply in the app. Nobody else sees it.</p>
      {!userId && !fixedEmail && <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email (customer or vendor)" className={inputCls} />}
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. Order #AB12CD34: please explain" className={inputCls} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Your question" className={`${inputCls} resize-none`} />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {sent && (
        <p className="text-xs text-emerald-700">
          Sent as <Link href={`/staff-panel/tickets/${sent.id}`} className="font-semibold underline">{sent.reference}</Link>.
        </p>
      )}
      <div className="flex gap-2">
        <button className={btn.dark} disabled={busy || !subject.trim() || !message.trim() || (!userId && !email.trim())} onClick={send}>
          {busy ? 'Sending...' : 'Send privately'}
        </button>
        <button className={btn.ghost} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
