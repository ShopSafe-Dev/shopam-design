'use client';

import { useParams } from 'next/navigation';
import DisputeThread from '@/app/components/disputes/DisputeThread';

export default function VendorDisputePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-3xl">
      <DisputeThread id={id} backHref="/dashboard/disputes" />
    </div>
  );
}
