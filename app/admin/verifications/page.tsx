'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { staffApi } from '@/lib/api/endpoints/staff';
import type * as S from '@/lib/api/openapi-types';
import Modal from '@/app/components/ui/Modal';
import { asList, Badge, Card, Empty, ErrorBox, PageHeader, Spinner, btn, errMsg, inputCls } from '../ui';

type VType = 'all' | 'cac' | 'tin' | 'address' | 'bank';
const TYPES: VType[] = ['all', 'cac', 'tin', 'address', 'bank'];

const FIELDS: [keyof S.VendorVerification, string][] = [
  ['cac_number', 'CAC number'],
  ['tin_number', 'TIN number'],
  ['address', 'Address'],
  ['bank_account', 'Bank account'],
  ['bank_code', 'Bank code'],
];

/** Document objects are untyped in the spec: link whichever URL-like key is present. */
function docLink(d: Record<string, unknown>): { href?: string; label: string } {
  const href = ['signed_url', 'url', 'file', 'document', 'link'].map((k) => d[k]).find((v) => typeof v === 'string') as string | undefined;
  const label = (['filename', 'name', 'original_name'].map((k) => d[k]).find((v) => typeof v === 'string') as string) || 'Document';
  return { href, label };
}

function vendorLabel(v: Record<string, unknown> | undefined): string {
  if (!v) return 'Unknown vendor';
  const pick = ['business_name', 'name', 'store_name', 'email', 'username'].map((k) => v[k]).find((x) => typeof x === 'string');
  return (pick as string) || JSON.stringify(v);
}

export default function VerificationsPage() {
  const [type, setType] = useState<VType>('all');
  const [items, setItems] = useState<S.VendorVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rejecting, setRejecting] = useState<S.VendorVerification | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(asList<S.VendorVerification>(await staffApi.verifyVendorList(type === 'all' ? undefined : { type })));
    } catch (err) {
      setError(errMsg(err, 'Could not load verification requests.'));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (v: S.VendorVerification, status: 'approve' | 'reject', why?: string) => {
    setBusyId(v.id);
    setActionError('');
    try {
      await staffApi.verifyVendorCreate({ verif_id: v.id }, { status, ...(why ? { reason: why } : {}) });
      setItems((prev) => prev.filter((x) => x.id !== v.id));
      setRejecting(null);
      setReason('');
    } catch (err) {
      setActionError(errMsg(err, 'Could not save the decision.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Vendor verifications" subtitle="Pending CAC, TIN, address and bank submissions" />

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${type === t ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {actionError && <div className="mb-3"><ErrorBox message={actionError} /></div>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Card><Empty text="Nothing pending. All caught up." /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{vendorLabel(v.vendor)}</p>
                  <div className="mt-1"><Badge tone="amber">{v.verification_type}</Badge></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setActionError(''); setRejecting(v); }} disabled={busyId === v.id} className={btn.ghost}>
                    Reject
                  </button>
                  <button onClick={() => decide(v, 'approve')} disabled={busyId === v.id} className={btn.primary}>
                    {busyId === v.id && <Loader2 size={14} className="animate-spin" />} Approve
                  </button>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {FIELDS.filter(([k]) => v[k]).map(([k, label]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-slate-500">{label}:</dt>
                    <dd className="break-all font-medium text-ink">{String(v[k])}</dd>
                  </div>
                ))}
              </dl>

              {v.documents?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.documents.map((d, i) => {
                    const { href, label } = docLink(d as Record<string, unknown>);
                    return href ? (
                      <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-200">
                        {label}
                      </a>
                    ) : (
                      <span key={i} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">{label}</span>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!rejecting}
        title="Reject verification"
        description="The vendor sees this reason, so be specific."
        onClose={() => setRejecting(null)}
        footer={
          <button
            onClick={() => rejecting && decide(rejecting, 'reject', reason.trim())}
            disabled={!reason.trim() || busyId === rejecting?.id}
            className={`${btn.danger} w-full`}
          >
            {busyId === rejecting?.id && <Loader2 size={14} className="animate-spin" />} Reject
          </button>
        }
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. CAC number does not match the uploaded certificate."
          className={inputCls}
        />
      </Modal>
    </>
  );
}
