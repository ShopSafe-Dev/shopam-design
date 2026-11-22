'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ConversationList from '@/app/components/chat/ConversationList';
import { ConnectionBanner } from '@/app/components/chat/ConnectionPill';
import { useConversations } from '@/lib/chat/hooks';
import { useUser } from '@/lib/auth/useUser';

/** Vendor inbox: buyers who messaged you. Customer chats live under /chats and never mix with these. */
export default function VendorMessagesPage() {
  const inbox = useConversations();
  const { user } = useUser();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? inbox.list.filter((c) => c.name.toLowerCase().includes(needle) || c.last.content.toLowerCase().includes(needle)) : inbox.list;
  }, [inbox.list, q]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Messages</h2>
          <p className="text-xs text-slate-600">Buyers who contacted you about products or orders.</p>
        </div>
      </div>
      <ConnectionBanner link={inbox.link} />
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search buyers or messages"
          aria-label="Search messages"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-slate-500 focus:border-ink"
        />
      </label>
      <ConversationList
        rows={rows}
        meId={user?.id ?? null}
        loading={inbox.loading}
        error={inbox.error}
        onRetry={inbox.reload}
        hrefFor={(c) => `/dashboard/messages/${c.userId}?name=${encodeURIComponent(c.name)}`}
        emptyTitle={q ? 'No matches' : 'No messages yet'}
        emptyText={q ? 'Try a different name or word.' : 'When a buyer messages you, the conversation appears here.'}
      />
    </div>
  );
}
