'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { financeService, type VatMonth } from '@/lib/api/finance';
import { Badge, Card, Empty, ErrorBox, Spinner, btn, errMsg, fmtDate, inputCls, naira } from '../ui';

const num = (s: string | null | undefined) => Number(s) || 0;
const monthName = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
};

function FileForm({ m, done }: { m: VatMonth; done: () => void }) {
  const [reference, setReference] = useState(m.reference);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await financeService.markVatFiled(m.period, reference.trim(), note.trim());
      done();
    } catch (e) {
      setError(errMsg(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-600">After filing on the tax portal, enter its reference or receipt number. The VAT total for the month ({naira(num(m.vat))}) is stored with it.</p>
      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Filing reference" className={inputCls} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inputCls} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className={btn.dark} disabled={busy || !reference.trim()} onClick={save}>{busy ? 'Saving...' : m.filed ? 'Update filing' : 'Mark filed'}</button>
    </div>
  );
}

export default function VatTab() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [months, setMonths] = useState<VatMonth[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMonths((await financeService.vat(year)).months);
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Could not load VAT.'));
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (period: string) => {
    setDownloading(period);
    try {
      await financeService.downloadVatSchedule(period);
    } catch (e) {
      setError(errMsg(e, 'Could not download the schedule.'));
    } finally {
      setDownloading(null);
    }
  };

  const unfiled = (months ?? []).filter((m) => !m.filed && num(m.vat) > 0 && m.period !== `${thisYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {[thisYear, thisYear - 1].map((y) => (
            <button key={y} onClick={() => { setYear(y); setMonths(null); }} className={`rounded-full px-3 py-1.5 text-xs font-bold ${year === y ? 'bg-ink text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {y}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600">VAT is counted on the month the customer paid. Refunded payments are left out of the totals but listed in the schedule.</p>
      </div>

      {unfiled.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {unfiled.length} past month{unfiled.length === 1 ? '' : 's'} not marked filed: {unfiled.map((m) => monthName(m.period)).join(', ')}.
        </p>
      )}

      {error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : !months ? (
        <Spinner />
      ) : months.length === 0 ? (
        <Empty text="No months yet." />
      ) : (
        <div className="space-y-2">
          {months.map((m) => (
            <Card key={m.period} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">{monthName(m.period)}</p>
                  <p className="text-xs text-slate-600">
                    {m.transactions} payments{m.refunded_transactions ? ` (${m.refunded_transactions} refunded)` : ''} · taxable {naira(num(m.taxable))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-ink">{naira(num(m.vat))}</span>
                  {m.filed ? <Badge tone={m.changed_since_filing ? 'amber' : 'green'}>{m.changed_since_filing ? 'Changed since filing' : 'Filed'}</Badge> : <Badge tone="slate">Not filed</Badge>}
                </div>
              </div>
              {m.filed && (
                <p className="mt-2 text-xs text-slate-600">
                  Filed {fmtDate(m.filed_at)} · ref <span className="font-mono">{m.reference}</span> · {naira(num(m.filed_vat))} filed
                  {m.changed_since_filing && <span className="text-amber-700"> · VAT has changed since (a refund came in). Check if an amendment is needed.</span>}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btn.ghost} disabled={downloading === m.period || m.transactions === 0} onClick={() => download(m.period)}>
                  <Download size={14} /> {downloading === m.period ? 'Preparing...' : 'Schedule (CSV)'}
                </button>
                <button className={btn.ghost} onClick={() => setOpen(open === m.period ? null : m.period)}>
                  {open === m.period ? 'Cancel' : m.filed ? 'Edit filing' : 'Mark filed'}
                </button>
              </div>
              {open === m.period && <FileForm m={m} done={() => { setOpen(null); void load(); }} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
