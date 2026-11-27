'use client';

import DisputeList from '@/app/components/disputes/DisputeList';

export default function VendorDisputesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Disputes</h2>
        <p className="mt-0.5 text-sm text-slate-600">Customers who reported a problem with a delivered order. Answer quickly: the payout for a disputed order is paused until ShopSafeNG decides.</p>
      </div>
      <DisputeList role="vendor" hrefBase="/dashboard/disputes" />
    </div>
  );
}
