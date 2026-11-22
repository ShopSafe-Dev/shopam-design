'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useThread } from '@/lib/chat/hooks';
import Avatar from './Avatar';
import Composer from './Composer';
import ConnectionPill, { LiveDot } from './ConnectionPill';
import MessageList from './MessageList';

interface Props {
  otherId: string;
  /** Name to show until the first message tells us (e.g. from a "Message seller" link). */
  fallbackName?: string;
  subtitle?: string;
  backHref: string;
  accent: 'ink' | 'brand';
  /** Outer sizing: the customer page is full screen, the vendor page sits inside the dashboard. */
  className: string;
  headerRight?: ReactNode;
  banner?: ReactNode;
  emptyText: string;
}

/**
 * One 1:1 conversation. Same engine for both roles; the CALLER (customer page or vendor page)
 * decides the route, colour and surrounding chrome. Which bubbles are "mine" comes only from
 * message.sender === my user id, so a role mix-up cannot flip sides.
 */
export default function ThreadWindow({ otherId, fallbackName = '', subtitle, backHref, accent, className, headerRight, banner, emptyText }: Props) {
  const t = useThread(otherId);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = t.name || fallbackName || 'Chat';

  const send = () => {
    const text = draft;
    setDraft('');
    void t.send(text);
    inputRef.current?.focus();
  };

  return (
    <div className={`flex flex-col overflow-hidden bg-canvas ${className}`}>
      <header className="z-10 flex-shrink-0 border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-3 sm:px-5">
          <Link href={backHref} aria-label="Back" className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <Avatar id={otherId} name={name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <div className="flex items-center gap-2">
              {subtitle && <span className="truncate text-[11px] text-slate-500">{subtitle}</span>}
              <LiveDot link={t.link} />
            </div>
          </div>
          {headerRight}
        </div>
      </header>

      <ConnectionPill link={t.link} />
      {banner}

      {t.error && t.messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-slate-600">{t.error}</p>
          <button onClick={() => void t.reload()} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      ) : (
        <MessageList
          messages={t.messages}
          meId={t.meId}
          loading={t.loading}
          hasMore={t.hasMore}
          loadingOlder={t.loadingOlder}
          onLoadOlder={() => void t.loadOlder()}
          onRetry={(id) => void t.retry(id)}
          onDiscard={t.discard}
          accent={accent}
          empty={
            <div className="mx-auto flex max-w-xs flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <MessageCircle size={22} />
              </span>
              <p className="text-[13px] text-slate-600">{emptyText}</p>
            </div>
          }
        />
      )}

      <Composer value={draft} onChange={setDraft} onSend={send} accent={accent} inputRef={inputRef} />
    </div>
  );
}
