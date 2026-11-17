'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { reviewsApi } from '@/lib/api/endpoints/reviews';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, btn, errMsg } from '../ui';

type Kind = 'product' | 'vendor';
type Item = { kind: Kind | null; data: Record<string, unknown> };

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/**
 * GET /api/reviews/staff/reported/ has no response schema. Accept either
 * { product_reviews: [...], vendor_reviews: [...] } (any key containing "product"/"vendor"),
 * or a flat list whose items say which kind they are. Anything else is shown read-only.
 */
function normalize(raw: unknown): Item[] {
  const out: Item[] = [];
  const kindOf = (hint: string): Kind | null => (/product/i.test(hint) ? 'product' : /vendor/i.test(hint) ? 'vendor' : null);
  const push = (rows: unknown, keyHint: string) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const d = r as Record<string, unknown>;
      out.push({ kind: kindOf(keyHint) ?? kindOf(str(d.review_type) + str(d.type) + str(d.kind) + str(d.target_type)), data: d });
    }
  };
  if (Array.isArray(raw)) push(raw, '');
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (Array.isArray(v)) push(v, k);
      else if (v && typeof v === 'object' && Array.isArray((v as { results?: unknown }).results)) push((v as { results: unknown }).results, k);
    }
  }
  return out;
}

export default function AdminReviewsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(normalize(await reviewsApi.staffReportedRetrieve()));
    } catch (err) {
      setError(errMsg(err, 'Could not load reported reviews.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (it: Item, status: 'published' | 'hidden') => {
    const id = str(it.data.id);
    if (!id || !it.kind) return;
    setBusyId(id);
    setActionError('');
    try {
      if (it.kind === 'product') await reviewsApi.staffProductReviewsPartialUpdate(id, { status });
      else await reviewsApi.staffVendorReviewsPartialUpdate(id, { status });
      setItems((prev) => prev.map((x) => (x === it ? { ...x, data: { ...x.data, status } } : x)));
    } catch (err) {
      setActionError(errMsg(err, 'Could not update the review.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Reported reviews" subtitle="Hide or restore reviews that users reported" />
      {actionError && <div className="mb-3"><ErrorBox message={actionError} /></div>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card><Empty text="No reported reviews." /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => {
            const id = str(it.data.id);
            const status = str(it.data.status);
            const text = str(it.data.comment) || str(it.data.body) || str(it.data.text) || str(it.data.content);
            const busy = busyId === id;
            return (
              <Card key={id || i} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{it.kind ?? 'unknown type'}</Badge>
                    {str(it.data.rating) && <Badge tone="amber">{str(it.data.rating)} / 5</Badge>}
                    {status && <Badge tone={status === 'hidden' ? 'red' : 'green'}>{status}</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => moderate(it, 'hidden')} disabled={!it.kind || !id || busy || status === 'hidden'} className={btn.danger}>
                      {busy && <Loader2 size={14} className="animate-spin" />} Hide
                    </button>
                    <button onClick={() => moderate(it, 'published')} disabled={!it.kind || !id || busy || status === 'published'} className={btn.ghost}>
                      Restore
                    </button>
                  </div>
                </div>
                {text && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{text}</p>}
                {!it.kind && <p className="mt-2 text-xs text-amber-700">Could not tell if this is a product or vendor review, so moderation is disabled for it.</p>}
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">Raw data</summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(it.data, null, 2)}</pre>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
