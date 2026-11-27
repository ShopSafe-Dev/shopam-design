'use client';

import AppBar from '@/app/components/ui/AppBar';
import BottomNav from '@/app/components/BottomNav';
import DisputeList from '@/app/components/disputes/DisputeList';

export default function MyDisputesPage() {
  return (
    <div className="min-h-screen bg-canvas pb-28 md:pb-16">
      <AppBar title="My disputes" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-slate-600">Problems you reported on delivered orders. Your money stays with ShopSafeNG until each one is decided.</p>
        <DisputeList hrefBase="/disputes" />
      </div>
      <BottomNav />
    </div>
  );
}
