'use client';

import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api/endpoints/analytics';
import { Card, ErrorBox, Spinner, PageHeader, errMsg, naira, inputCls } from './ui';

type Period = '7d' | '30d' | '90d' | '12m';
type Json = Record<string, unknown>;

const humanize = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const MONEY = /gmv|revenue|commission|amount|earning|payout|balance|sales|value/i;

function show(key: string, v: unknown): string {
  if (typeof v === 'number') return MONEY.test(key) ? naira(v) : v.toLocaleString();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v === null || v === undefined) return '-';
  return String(v);
}

const isScalar = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

/** The overview response is not typed in the spec, so render whatever shape comes back. */
function Section({ title, data }: { title?: string; data: Json }) {
  const scalars = Object.entries(data).filter(([, v]) => isScalar(v));
  const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v)) as [string, unknown[]][];
  const objects = Object.entries(data).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)) as [string, Json][];

  return (
    <section className="space-y-3">
      {title && <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{humanize(title)}</h2>}

      {scalars.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {scalars.map(([k, v]) => (
            <Card key={k} className="p-4">
              <p className="text-xs font-semibold text-slate-500">{humanize(k)}</p>
              <p className="mt-1 break-words text-xl font-bold text-ink">{show(k, v)}</p>
            </Card>
          ))}
        </div>
      )}

      {arrays.map(([k, rows]) => {
        const objs = rows.filter((r) => r && typeof r === 'object') as Json[];
        if (!objs.length) return null;
        const cols = Object.keys(objs[0]).filter((c) => isScalar(objs[0][c])).slice(0, 6);
        return (
          <Card key={k} className="overflow-x-auto">
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-ink">{humanize(k)}</p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="px-4 py-2 font-semibold">{humanize(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {objs.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {cols.map((c) => (
                      <td key={c} className="px-4 py-2">{show(c, r[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}

      {objects.map(([k, o]) => (
        <Section key={k} title={k} data={o} />
      ))}
    </section>
  );
}

export default function StaffOverviewPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<Json | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await analyticsApi.staffOverviewRetrieve({ period })) as unknown as Json;
      setData(res && typeof res === 'object' ? res : {});
    } catch (err) {
      setError(errMsg(err, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Platform GMV, orders, commission, sign-ups and disputes"
        action={
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={`${inputCls} !w-auto`} aria-label="Period">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
        }
      />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={load} /> : data && <Section data={data} />}
    </>
  );
}
