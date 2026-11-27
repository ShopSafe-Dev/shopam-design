'use client';

import { useParams } from 'next/navigation';
import AppBar from '@/app/components/ui/AppBar';
import BottomNav from '@/app/components/BottomNav';
import TicketThread from '@/app/components/support/TicketThread';

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-canvas pb-28 md:pb-16">
      <AppBar title="Support request" />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <TicketThread id={id} backHref="/support" />
      </div>
      <BottomNav />
    </div>
  );
}
