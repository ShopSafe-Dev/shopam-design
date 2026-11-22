'use client';

import { useEffect, type RefObject } from 'react';
import { Send } from 'lucide-react';
import { MAX_LEN } from '@/lib/chat/types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  accent: 'ink' | 'brand';
  placeholder?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function Composer({ value, onChange, onSend, accent, placeholder = 'Type a message', inputRef }: Props) {
  const innerRef = inputRef;

  useEffect(() => {
    const el = innerRef?.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, innerRef]);

  const len = value.length;
  const tooLong = len > MAX_LEN;
  const canSend = value.trim().length > 0 && !tooLong;

  return (
    <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto max-w-2xl px-3 py-3 sm:px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) onSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition-colors focus-within:border-ink focus-within:bg-white">
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
                // Touch keyboards: Enter is a new line, the send button sends. Desktop: Enter sends.
                if (window.matchMedia('(pointer: coarse)').matches) return;
                e.preventDefault();
                if (canSend) onSend();
              }}
              placeholder={placeholder}
              rows={1}
              aria-label="Message"
              className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent px-5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              accent === 'brand' ? 'bg-[#FA3728] hover:bg-[#E31B23]' : 'bg-ink hover:bg-[#FA3728]'
            }`}
          >
            <Send size={17} />
          </button>
        </form>
        {len > MAX_LEN - 500 && (
          <p className={`mt-1.5 px-2 text-right text-[11px] ${tooLong ? 'font-bold text-red-600' : 'text-slate-500'}`}>
            {len}/{MAX_LEN}
          </p>
        )}
      </div>
    </div>
  );
}
