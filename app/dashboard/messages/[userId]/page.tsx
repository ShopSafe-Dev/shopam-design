'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import ThreadWindow from '@/app/components/chat/ThreadWindow';

/** Vendor-side chat with one buyer, inside the dashboard shell. */
export default function VendorThreadPage() {
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const [name, setName] = useState('');

  useEffect(() => {
    setName(new URLSearchParams(window.location.search).get('name') ?? '');
  }, []);

  if (!userId) return null;
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
      <ThreadWindow
        otherId={userId}
        fallbackName={name}
        subtitle="Buyer"
        backHref="/dashboard/messages"
        accent="brand"
        className="h-[calc(100dvh-11.5rem)] md:h-[calc(100dvh-9.25rem)]"
        headerRight={
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ShoppingBag size={13} /> Orders
          </Link>
        }
        emptyText="No messages yet. Reply here to answer the buyer."
      />
    </div>
  );
}
