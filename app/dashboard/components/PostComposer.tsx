'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { postsService } from '@/lib/api';
import { toFeedPost, type FeedPost } from '@/app/components/feed/data';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Inline "write a post" box, used on Home and on the Posts page. */
export default function PostComposer({ authorName, logo, onCreated }: { authorName: string; logo?: string | null; onCreated: (post: FeedPost) => void }) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f?: File) => {
    setError('');
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError('Use a JPEG, PNG or WebP image.');
    if (f.size > MAX_BYTES) return setError('That image is over 10 MB.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!caption.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await postsService.createPost({ caption: caption.trim(), media: file ? [file] : undefined });
      const mapped = toFeedPost(saved);
      onCreated({ ...mapped, vendorName: mapped.vendorName || authorName || 'Your shop', image: mapped.image || preview || '', timeAgo: 'Just now' });
      setCaption('');
      clearImage();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; detail?: string } } };
      setError(err.response?.data?.error ?? err.response?.data?.detail ?? 'Could not publish the post. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            (authorName || 'S').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={caption ? 3 : 2}
            maxLength={2000}
            placeholder="Share an update, a new arrival, a behind the scenes..."
            className="w-full resize-none rounded-xl border border-transparent bg-slate-50 px-3 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-slate-500 focus:border-slate-200 focus:bg-white sm:text-sm"
          />
          {preview && (
            <div className="relative mt-3 w-full max-w-sm overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected" className="aspect-square w-full object-cover" />
              <button type="button" onClick={clearImage} aria-label="Remove image" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                <X size={15} />
              </button>
            </div>
          )}
          {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink">
              <ImagePlus size={15} /> {file ? 'Change photo' : 'Add photo'}
            </button>
            <input ref={fileRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={submit}
              disabled={!caption.trim() || busy}
              className="flex items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
