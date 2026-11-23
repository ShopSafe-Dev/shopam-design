'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, MessageCircle } from 'lucide-react';
import type { Conversation } from '@/lib/chat/hooks';
import Avatar from './Avatar';
import UnreadBadge from './UnreadBadge';
import { listStamp } from './time';

interface Props {
  rows: Conversation[];
  meId: string | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  hrefFor: (c: Conversation) => string;
  emptyTitle: string;
  emptyText: string;
}

/** Inbox list shared by the customer and vendor message pages. Each passes its own route builder. */
export default function ConversationList({ rows, meId, loading, error, onRetry, hrefFor, emptyTitle, emptyText }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#FA3728]" size={26} />
      </div>
    );
  }
  if (error && rows.length === 0) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}{' '}
        <button onClick={onRetry} className="font-bold underline">
          Try again
        </button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <MessageCircle size={24} />
        </span>
        <p className="text-sm font-bold text-ink">{emptyTitle}</p>
        <p className="max-w-xs text-xs text-slate-600">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      {rows.map((c, i) => {
        const mine = c.last.sender === meId;
        return (
          <motion.div key={c.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
            <Link href={hrefFor(c)} className="flex items-center gap-3.5 border-b border-slate-100 px-4 py-3.5 transition-colors last:border-0 hover:bg-slate-50/70">
              <Avatar id={c.other || c.key} name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={`truncate text-sm text-ink ${c.unread ? 'font-extrabold' : 'font-bold'}`}>
                    {c.name}
                    {c.orderRef && <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-600">#{c.orderRef}</span>}
                  </h3>
                  <span className={`shrink-0 text-[11px] ${c.unread ? 'font-bold text-[#FA3728]' : 'text-slate-500'}`}>{listStamp(c.last.created_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-[13px] ${c.unread ? 'font-semibold text-ink' : 'text-slate-600'}`}>
                    {mine && <span className="text-slate-500">You: </span>}
                    {c.last.content}
                  </p>
                  <UnreadBadge count={c.unread} className="shrink-0" />
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
