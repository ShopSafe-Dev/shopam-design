'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService, ordersService } from '@/lib/api';
import type { Order } from '@/lib/api';
import ThreadWindow from '@/app/components/chat/ThreadWindow';

/** Customer chat with the seller about ONE order. The order itself (status, steps, payment) lives at /chats/<id>. */
export default function CustomerOrderMessagesPage() {
  const params = useParams();
  const orderId = String(params?.orderId ?? '');
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void authService.ensureUser().then((u) => {
      if (!u) {
        router.replace(`/auth/signin?redirect=${encodeURIComponent(`/chats/${orderId}/messages`)}`);
        return;
      }
      ordersService.getOrder(orderId).then(setOrder).catch(() => {});
    });
  }, [orderId, router]);

  if (!orderId) return null;
  return (
    <ThreadWindow
      order={orderId}
      otherId={order ? order.vendor_user_id ?? null : null}
      fallbackName={order?.vendor_name || 'Seller'}
      subtitle={`Order #${orderId.slice(0, 8).toUpperCase()}`}
      backHref={`/chats/${orderId}`}
      accent="ink"
      className="h-[100dvh]"
      emptyText="Ask the seller about this order. Order updates show on the order page, not here."
    />
  );
}
