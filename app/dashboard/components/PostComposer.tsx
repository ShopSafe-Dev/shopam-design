'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, ShoppingBag, X } from 'lucide-react';
import { postsService, productsService } from '@/lib/api';
import type { ProductService } from '@/lib/api';
import { money } from '@/lib/order-steps';
import { toFeedPost, type FeedPost } from '@/app/components/feed/data';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PRODUCTS = 5;

/** Inline "write a post" box, used on Home and on the Posts page. */
export default function PostComposer({ authorName, logo, onCreated }: { authorName: string; logo?: string | null; onCreated: (post: FeedPost) => void }) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mine, setMine] = useState<ProductService[] | null>(null);
  const [mineError, setMineError] = useState('');
  const [picked, setPicked] = useState<ProductService[]>([]);
  const [filter, setFilter] = useState('');

  const openPicker = () => {
    setPickerOpen((v) => !v);
    if (mine === null) {
      productsService
        .getMyProducts()
        .then((r) => setMine(Array.isArray(r) ? r : []))
        .catch(() => setMineError('Could not load your products.'));
    }
  };

  const toggle = (p: ProductService) =>
    setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : cur.length >= MAX_PRODUCTS ? cur : [...cur, p]));

  const shown = (mine ?? []).filter((p) => p.title.toLowerCase().includes(filter.trim().toLowerCase()));

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
      const saved = await postsService.createPost({ caption: caption.trim(), media: file ? [file] : undefined, product_ids: picked.map((p) => p.id) });
      const mapped = toFeedPost(saved);
      onCreated({ ...mapped, vendorName: mapped.vendorName || authorName || 'Your shop', image: mapped.image || preview || '', timeAgo: 'Just now' });
      setCaption('');
      clearImage();
      setPicked([]);
      setPickerOpen(false);
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
          {picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {picked.map((p) => (
                <span key={p.id} className="flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink">
                  <span className="truncate">{p.title}</span>
                  <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.title}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-200"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          {pickerOpen && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search your products"
                className="w-full rounded-t-xl border-b border-slate-100 px-3 py-2.5 text-base outline-none sm:text-sm"
              />
              <ul className="max-h-56 overflow-y-auto py-1">
                {mineError && <li className="px-3 py-2 text-sm text-red-600">{mineError}</li>}
                {mine === null && !mineError && <li className="px-3 py-2 text-sm text-slate-600">Loading...</li>}
                {mine !== null && shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-600">{mine.length === 0 ? 'You have no products yet.' : 'No product matches.'}</li>}
                {shown.map((p) => {
                  const on = picked.some((x) => x.id === p.id);
                  const full = !on && picked.length >= MAX_PRODUCTS;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => toggle(p)} disabled={full} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? 'border-[#FA3728] bg-[#FA3728] text-white' : 'border-slate-300'}`}>{on && <Check size={13} strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{p.title}</span>
                        <span className="shrink-0 text-[12px] font-bold text-slate-600">{money(Number(p.price) || 0)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600">{picked.length} of {MAX_PRODUCTS} selected. Buyers can add these to their cart straight from your post.</p>
            </div>
          )}
          {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink">
                <ImagePlus size={15} /> {file ? 'Change photo' : 'Add photo'}
              </button>
              <button type="button" onClick={openPicker} aria-expanded={pickerOpen} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink">
                <ShoppingBag size={15} /> {picked.length > 0 ? `Products (${picked.length})` : 'Tag products'}
              </button>
            </div>
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
