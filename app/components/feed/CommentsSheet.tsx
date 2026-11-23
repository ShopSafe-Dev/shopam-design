'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send, Trash2, X } from 'lucide-react';
import { feedApi, errorText, isAuthError, type FeedComment } from '@/lib/feed/api';
import { useUser } from '@/lib/auth/useUser';
import { timeAgo } from '@/lib/format';

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  /** Keeps the count on the card in step with what the sheet shows. */
  onCountChange: (delta: number) => void;
}

const nameOf = (c: FeedComment) => [c.user.first_name, c.user.last_name].filter(Boolean).join(' ') || c.user.username || 'User';

/** Bottom sheet with a post's comments. Comments come newest-first from the API. */
export default function CommentsSheet({ postId, open, onClose, onCountChange }: Props) {
  const { user } = useUser();
  const [items, setItems] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await feedApi.comments(postId)).results);
    } catch {
      setError('Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (open && !loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const c = await feedApi.addComment(postId, text);
      setItems((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
      setDraft('');
      onCountChange(1);
    } catch (e) {
      setError(isAuthError(e) ? 'Sign in to comment.' : errorText(e, 'Could not post your comment.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: FeedComment) => {
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    onCountChange(-1);
    try {
      await feedApi.deleteComment(c.id);
    } catch {
      setItems((prev) => [c, ...prev]);
      onCountChange(1);
      setError('Could not delete that comment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Comments">
      <button aria-label="Close comments" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-bold text-ink">Comments</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-[8rem] flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#FA3728]" size={22} />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{error || 'No comments yet. Start the conversation.'}</p>
          ) : (
            <ul className="space-y-4">
              {items.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                    {nameOf(c).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      <span className="font-bold">{nameOf(c)}</span>{' '}
                      <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-snug text-slate-700">{c.comment}</p>
                  </div>
                  {user?.id === c.user.id && (
                    <button onClick={() => void remove(c)} aria-label="Delete comment" className="self-start rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {error && items.length > 0 && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div className="border-t border-slate-100 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          {user ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                maxLength={500}
                placeholder="Add a comment"
                aria-label="Add a comment"
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-ink outline-none focus:border-ink focus:bg-white"
              />
              <button
                onClick={() => void submit()}
                disabled={!draft.trim() || busy}
                aria-label="Post comment"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white hover:bg-[#FA3728] disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          ) : (
            <Link href={`/auth/signin?redirect=${encodeURIComponent('/feed')}`} className="block rounded-full bg-ink py-2.5 text-center text-sm font-bold text-white">
              Sign in to comment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
