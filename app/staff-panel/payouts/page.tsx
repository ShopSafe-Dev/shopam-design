'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '../ui';
import PayoutQueueTab from './PayoutQueue';
import EarningsTab from './Earnings';
import VatTab from './Vat';

const TABS = [
  { id: 'payouts', label: 'Vendor payouts' },
  { id: 'earnings', label: 'Our earnings' },
  { id: 'vat', label: 'VAT' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function StaffFinancePage() {
  const [tab, setTab] = useState<Tab>('payouts');

  // Remember the tab in the URL hash so a refresh stays put.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };

  return (
    <>
      <PageHeader title="Finance" subtitle="Vendor payouts, ShopSafeNG's own earnings and VAT. Figures are live." />
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => choose(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'payouts' && <PayoutQueueTab />}
      {tab === 'earnings' && <EarningsTab />}
      {tab === 'vat' && <VatTab />}
    </>
  );
}
