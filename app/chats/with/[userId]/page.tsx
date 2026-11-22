'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/lib/api';
import ThreadWindow from '@/app/components/chat/ThreadWindow';

/** Customer-side direct chat with a seller (not tied to one order). Vendor mode never lands here. */
export default function CustomerDirectChatPage() {
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    setName(new URLSearchParams(window.location.search).get('name') ?? '');
    void authService.ensureUser().then((u) => {
      if (!u) router.replace(`/auth/signin?redirect=${encodeURIComponent(`/chats/with/${userId}`)}`);
      else setReady(true);
    });
  }, [router, userId]);

  if (!ready || !userId) return null;
  return (
    <ThreadWindow
      otherId={userId}
      fallbackName={name}
      subtitle="Seller"
      backHref="/chats?tab=messages"
      accent="ink"
      className="h-[100dvh]"
      emptyText="Say hello. Ask about availability, delivery or anything else before you order."
    />
  );
}
