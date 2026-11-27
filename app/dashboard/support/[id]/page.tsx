'use client';

import { useParams } from 'next/navigation';
import TicketThread from '@/app/components/support/TicketThread';

export default function VendorSupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-3xl">
      <TicketThread id={id} backHref="/dashboard/support" />
    </div>
  );
}
