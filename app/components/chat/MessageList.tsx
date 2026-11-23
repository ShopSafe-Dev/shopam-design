'use client';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Check, CheckCheck, Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { ChatMsg } from '@/lib/chat/types';
import { dayLabel, sameDay, timeLabel } from './time';

interface Props {
  messages: ChatMsg[];
  meId: string | null;
  loading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  /** Colour of MY bubbles. Customer = ink, vendor = brand, so the two UIs never look alike. */
  accent: 'ink' | 'brand';
  empty?: ReactNode;
}

const GROUP_GAP_MS = 5 * 60_000;

export default function MessageList({ messages, meId, loading, hasMore, loadingOlder, onLoadOlder, onRetry, onDiscard, accent, empty }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const firstId = useRef('');
  const lastId = useRef('');
  const [unseen, setUnseen] = useState(0);

  const loadOlder = useCallback(() => {
    prevHeight.current = box.current?.scrollHeight ?? null;
    onLoadOlder();
  }, [onLoadOlder]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stick.current = near;
    if (near) setUnseen(0);
    if (el.scrollTop < 60 && hasMore && !loadingOlder) loadOlder();
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || messages.length === 0) return;
    const first = messages[0].id;
    const last = messages[messages.length - 1];
    if (prevHeight.current !== null && first !== firstId.current && last.id === lastId.current) {
      // Older messages were prepended: keep what the reader was looking at in place.
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (lastId.current === '') {
      el.scrollTop = el.scrollHeight;
    } else if (last.id !== lastId.current) {
      if (stick.current || last.sender === meId) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      else setUnseen((n) => n + 1);
    } else if (prevHeight.current !== null && !loadingOlder) {
      prevHeight.current = null;
    }
    firstId.current = first;
    lastId.current = last.id;
  }, [messages, meId, loadingOlder]);

  const mine = accent === 'brand' ? 'bg-[#FA3728] text-white' : 'bg-ink text-white';

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-[#FA3728]" size={26} />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} onScroll={onScroll} role="log" aria-live="polite" className="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        <div className="mx-auto flex max-w-2xl flex-col">
          {hasMore && (
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="mx-auto mb-3 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingOlder && <Loader2 size={12} className="animate-spin" />}
              Earlier messages
            </button>
          )}

          {messages.length === 0 && <div className="py-16">{empty}</div>}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const isMine = m.sender === meId;
            const newDay = !prev || !sameDay(prev.created_at, m.created_at);
            const joinsPrev = !!prev && !newDay && prev.sender === m.sender && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_GAP_MS;
            const joinsNext =
              !!next && sameDay(next.created_at, m.created_at) && next.sender === m.sender && Date.parse(next.created_at) - Date.parse(m.created_at) < GROUP_GAP_MS;
            if (m.is_system) {
              return (
                <div key={m.id} className="my-2 flex justify-center">
                  <span className="max-w-[85%] rounded-full bg-slate-200/60 px-3 py-1 text-center text-[11px] font-medium text-slate-600">{m.content}</span>
                </div>
              );
            }
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-slate-200/70 px-3 py-0.5 text-[11px] font-semibold text-slate-600">{dayLabel(m.created_at)}</span>
                  </div>
                )}
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${joinsPrev ? 'mt-0.5' : 'mt-3'}`}>
                  <div
                    className={`max-w-[84%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[72%] ${
                      isMine ? `${mine} ${m.local === 'sending' ? 'opacity-70' : ''}` : 'border border-slate-200/80 bg-white text-ink'
                    } rounded-2xl ${isMine ? 'rounded-br-md' : 'rounded-bl-md'} ${joinsPrev ? (isMine ? 'rounded-tr-md' : 'rounded-tl-md') : ''}`}
                  >
                    {m.content}
                  </div>

                  {m.local === 'failed' ? (
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-red-600">
                      Not sent
                      <button onClick={() => onRetry(m.id)} className="flex items-center gap-1 font-bold underline">
                        <RotateCcw size={11} /> Retry
                      </button>
                      <button onClick={() => onDiscard(m.id)} aria-label="Discard message" className="flex items-center gap-1 text-slate-500 hover:text-red-600">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ) : (
                    !joinsNext && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                        {timeLabel(m.created_at)}
                        {m.is_edited && <span>· edited</span>}
                        {isMine &&
                          (m.local === 'sending' ? (
                            <Clock size={10} aria-label="Sending" />
                          ) : m.is_read ? (
                            <CheckCheck size={12} className="text-sky-500" aria-label="Read" />
                          ) : (
                            <Check size={11} aria-label="Sent" />
                          ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unseen > 0 && (
        <button
          onClick={() => {
            box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
            setUnseen(0);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-bold text-white shadow-lg"
        >
          <ArrowDown size={13} />
          {unseen} new
        </button>
      )}
    </div>
  );
}
