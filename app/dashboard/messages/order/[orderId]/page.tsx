'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { ordersService } from '@/lib/api';
import type { Order } from '@/lib/api';
import { statusLabel } from '@/lib/order-steps';
import ThreadWindow from '@/app/components/chat/ThreadWindow';
import OrderSteps from '@/app/components/OrderSteps';

/** Vendor chat for ONE order. Every order has its own stream, even with the same buyer. */
export default function VendorOrderChatPage() {
  const params = useParams();
  const orderId = String(params?.orderId ?? '');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let live = true;
    const load = () =>
      ordersService
        .getOrder(orderId)
        .then((o) => live && setOrder(o))
        .catch(() => {});
    void load();
    const t = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [orderId]);

  if (!orderId) return null;
  const ref = orderId.slice(0, 8).toUpperCase();
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
      <ThreadWindow
        order={orderId}
        otherId={order?.customer}
        fallbackName={order?.customer_name || 'Buyer'}
        subtitle={`Order #${ref}${order ? ` · ${statusLabel(order.status)}` : ''}`}
        backHref="/dashboard/messages"
        accent="brand"
        className="h-[calc(100dvh-11.5rem)] md:h-[calc(100dvh-9.25rem)]"
        banner={order?.workflow ? <div className="border-b border-slate-200/70 bg-white px-4 py-2.5"><OrderSteps workflow={order.workflow} /></div> : undefined}
        headerRight={
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ShoppingBag size={13} /> Order
          </Link>
        }
        emptyText="No messages on this order yet. Reply here to answer the buyer."
      />
    </div>
  );
}
