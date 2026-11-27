'use client';

import SupportCenter from '@/app/components/support/SupportCenter';

export default function VendorSupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Help & support</h2>
        <p className="mt-0.5 text-sm text-slate-600">Questions about payouts, verification, listings or a customer. We reply here and by email.</p>
      </div>
      <SupportCenter hrefBase="/dashboard/support" />
    </div>
  );
}
