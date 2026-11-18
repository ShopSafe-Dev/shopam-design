'use client';

import { useState } from 'react';
import { staffApi } from '@/lib/api/endpoints/staff';
import ConfirmTypeModal from '@/app/components/ui/ConfirmTypeModal';
import { Card, ErrorBox, PageHeader, btn, errMsg, inputCls } from '../ui';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StaffPayoutsPage() {
  const [orderId, setOrderId] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const valid = UUID.test(orderId.trim());

  const settle = async () => {
    setBusy(true);
    setError('');
    try {
      // Response body is not described in the spec: show whatever comes back.
      const res: unknown = await staffApi.settleCreate({ order_id: orderId.trim() });
      setResult(res ? JSON.stringify(res, null, 2) : 'Payout triggered.');
      setOpen(false);
      setOrderId('');
    } catch (err) {
      setError(errMsg(err, 'Could not trigger the payout.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Vendor payouts" subtitle="Manually pay out one order through Monnify" />

      <Card className="max-w-xl p-5">
        {result && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p className="font-semibold">Payout request sent.</p>
            <pre className="mt-1 whitespace-pre-wrap break-all text-xs">{result}</pre>
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Order ID
          <input
            value={orderId}
            onChange={(e) => { setOrderId(e.target.value); setResult(null); }}
            placeholder="00000000-0000-0000-0000-000000000000"
            className={`${inputCls} mt-1.5 font-mono`}
            spellCheck={false}
          />
        </label>
        {orderId && !valid && <p className="mt-1.5 text-xs text-red-600">That is not a valid order ID.</p>}
        <p className="mt-3 text-xs text-slate-500">This moves real money to the vendor. Confirm the order is delivered or resolved before settling.</p>
        <button onClick={() => { setError(''); setOpen(true); }} disabled={!valid} className={`${btn.primary} mt-4`}>
          Settle order
        </button>
      </Card>

      <ConfirmTypeModal
        open={open}
        title="Settle order"
        description="Pay the vendor for this order now."
        warning={<>Order <span className="break-all font-mono">{orderId.trim()}</span> will be paid out to the vendor. This cannot be reversed from here.</>}
        confirmText="SETTLE"
        actionLabel="Pay out"
        busy={busy}
        error={error}
        onConfirm={settle}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
