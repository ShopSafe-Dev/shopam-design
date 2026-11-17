'use client';

import { useCallback, useEffect, useState } from 'react';
import { mailerApi } from '@/lib/api/endpoints/mailer';
import type * as S from '@/lib/api/openapi-types';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, errMsg, fmtDate, inputCls } from '../ui';

const STATUSES: S.EmailDeliveryStatusEnum[] = ['queued', 'accepted', 'delivered', 'delayed', 'bounced', 'complained', 'rejected', 'failed', 'unconfirmed'];
const GOOD = new Set(['delivered', 'accepted']);
const BAD = new Set(['bounced', 'complained', 'rejected', 'failed']);

export default function AdminMailerPage() {
  const [summary, setSummary] = useState<S.MailerSummary | null>(null);
  const [rows, setRows] = useState<S.Delivery[]>([]);
  const [status, setStatus] = useState('');
  const [to, setTo] = useState('');
  const [critical, setCritical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([
        mailerApi.summaryRetrieve(),
        mailerApi.deliveriesList({
          ...(status ? { status } : {}),
          ...(to.trim() ? { to: to.trim() } : {}),
          ...(critical ? { critical: true } : {}),
        }),
      ]);
      setSummary(s);
      setRows(d);
    } catch (err) {
      setError(errMsg(err, 'Could not load email deliveries.'));
    } finally {
      setLoading(false);
    }
  }, [status, to, critical]);

  useEffect(() => {
    const t = setTimeout(() => void load(), to ? 350 : 0); // debounce typing in the recipient filter
    return () => clearTimeout(t);
  }, [load, to]);

  return (
    <>
      <PageHeader title="Email deliveries" subtitle={summary ? `Last ${summary.window_hours} hours` : undefined} />

      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4"><p className="text-xs font-semibold text-slate-500">Total sent</p><p className="mt-1 text-xl font-bold">{summary.total.toLocaleString()}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold text-slate-500">Delivered rate</p><p className="mt-1 text-xl font-bold">{summary.delivered_rate == null ? '-' : `${(summary.delivered_rate <= 1 ? summary.delivered_rate * 100 : summary.delivered_rate).toFixed(1)}%`}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold text-slate-500">Critical not delivered</p><p className={`mt-1 text-xl font-bold ${summary.critical_not_delivered ? 'text-red-600' : ''}`}>{summary.critical_not_delivered}</p></Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-500">By status</p>
            <p className="mt-1 text-xs text-ink">{Object.entries(summary.by_status).map(([k, v]) => `${k}: ${v}`).join(' · ') || '-'}</p>
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient email" className={`${inputCls} sm:!w-64`} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Critical only
        </label>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Card><Empty text="No deliveries match." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">To</th>
                <th className="px-4 py-2.5 font-semibold">Subject</th>
                <th className="px-4 py-2.5 font-semibold">Kind</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 break-all">{d.to_email}</td>
                  <td className="px-4 py-2.5">
                    {d.subject}
                    {d.critical && <span className="ml-2"><Badge tone="red">critical</Badge></span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{d.kind}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={d.status && GOOD.has(d.status) ? 'green' : d.status && BAD.has(d.status) ? 'red' : 'amber'}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmtDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
