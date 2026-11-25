'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Camera, ImagePlus, Loader2, MapPin, Package, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { authService, postsService, productsService } from '@/lib/api';
import { useVendorProfile } from '@/lib/vendor/useVendorProfile';
import BusinessCover from '@/app/components/BusinessCover';
import type { ProductService } from '@/lib/api';
import ProductCard from '@/app/explore/components/ProductCard';
import PostCard from '@/app/components/feed/PostCard';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { FEED_POSTS, toFeedPost, type FeedPost } from '@/app/components/feed/data';

type Tab = 'products' | 'posts';

export default function VendorProfilePage() {
  const { vendor, loading: profileLoading, error: profileError, reload } = useVendorProfile();
  const profile = {
    name: vendor?.name ?? '',
    bio: vendor?.bio ?? '',
    category: vendor?.category ?? '',
    location: vendor?.address ?? '',
    logo: vendor?.logo ?? null,
    cacVerified: !!vendor?.cacVerified,
  };
  const [products, setProducts] = useState<ProductService[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>(FEED_POSTS.slice(0, 3));
  const [tab, setTab] = useState<Tab>('products');
  const [postOpen, setPostOpen] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');

  async function onLogoPicked(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setLogoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setLogoError('Use a JPEG, PNG or WebP image.');
    if (f.size > 5 * 1024 * 1024) return setLogoError('Logo must be 5MB or smaller.');
    setLogoBusy(true);
    try {
      await authService.uploadVendorLogo(f);
      reload();
    } catch (err: any) {
      setLogoError(err?.response?.data?.logo?.[0] ?? err?.response?.data?.error ?? 'Could not upload the logo.');
    } finally {
      setLogoBusy(false);
    }
  }

  async function onLogoRemove() {
    setLogoError('');
    setLogoBusy(true);
    try {
      await authService.removeVendorLogo();
      reload();
    } catch {
      setLogoError('Could not remove the logo.');
    } finally {
      setLogoBusy(false);
    }
  }

  useEffect(() => {
    productsService.getMyProducts().then((r) => setProducts(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Cover + identity: everything here comes from the vendor profile (edit it in Settings) */}
      {profileError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {profileError}
          <button onClick={reload} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-200">Retry</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
          {profileLoading ? (
            <div className="h-36 animate-pulse bg-slate-100 sm:h-48" />
          ) : (
            <BusinessCover name={profile.name} className="h-36 sm:h-48" />
          )}
          <div className="relative px-4 pb-4 sm:px-6">
            <div className="relative -mt-10 h-20 w-20 sm:h-24 sm:w-24">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-ink text-2xl font-black text-white shadow-md">
                {profile.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.logo} alt={`${profile.name} logo`} className="h-full w-full object-cover" />
                ) : (
                  (profile.name || ' ').charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                disabled={logoBusy}
                aria-label="Change logo"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              >
                {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onLogoPicked} />
            </div>
            {(logoError || profile.logo) && (
              <p className="mt-2 text-xs">
                {logoError && <span className="font-medium text-red-600">{logoError} </span>}
                {profile.logo && !logoBusy && (
                  <button type="button" onClick={onLogoRemove} className="font-semibold text-slate-500 underline hover:text-red-600">Remove logo</button>
                )}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {profileLoading ? (
                <div className="h-7 w-44 animate-pulse rounded bg-slate-100" />
              ) : (
                <h2 className="font-bricolage text-2xl font-black tracking-tight text-ink">{profile.name || 'Unnamed business'}</h2>
              )}
              {profile.cacVerified && <span title="CAC verified" className="flex h-5 w-5 items-center justify-center rounded-full bg-trust text-[10px] font-bold text-white">✓</span>}
            </div>
            {(profile.category || profile.location) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <MapPin size={14} /> {[profile.category, profile.location].filter(Boolean).join(' • ')}
              </p>
            )}
            {profile.bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{profile.bio}</p>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-200/70">
        {(['products', 'posts'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 pb-2.5 text-sm font-bold capitalize transition-colors ${tab === t ? 'border-[#FA3728] text-ink' : 'border-transparent text-slate-500 hover:text-slate-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div>
          <div className="mb-4 flex items-center justify-end">
            <Link href="/dashboard/products" className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#FA3728]">
              <Package size={15} /> Add product
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No products yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} onAddToCart={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'posts' && (
        <div className="mx-auto max-w-xl">
          <div className="mb-4 flex items-center justify-end">
            <button onClick={() => setPostOpen(true)} className="flex items-center gap-1.5 rounded-full bg-[#FA3728] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E31B23]">
              <Plus size={15} /> New post
            </button>
          </div>
          <div className="space-y-5">
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {postOpen && (
          <CreatePostModal
            onClose={() => setPostOpen(false)}
            onCreated={(post) => {
              setPosts((prev) => [post, ...prev]);
              setPostOpen(false);
            }}
            authorName={profile.name}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreatePostModal({
  onClose,
  onCreated,
  authorName,
}: {
  onClose: () => void;
  onCreated: (post: FeedPost) => void;
  authorName: string;
}) {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!caption.trim()) return;
    setBusy(true);
    let created: FeedPost | null = null;
    try {
      const saved = await postsService.createPost({ caption: caption.trim(), media: file ? [file] : undefined });
      // Real post from the API: real UUID, so like/comment/share work on it straight away.
      const mapped = toFeedPost(saved);
      created = { ...mapped, vendorName: mapped.vendorName || authorName || 'Your Shop', image: mapped.image || image || '', timeAgo: 'Just now' };
    } catch {
      /* dev/offline: show it locally. The demo- id keeps the card from calling the API. */
    }
    onCreated(
      created ?? {
        id: `demo-local-${Date.now()}`,
        vendorName: authorName || 'Your Shop',
        verified: true,
        timeAgo: 'Just now',
        image: image ?? '',
        caption: caption.trim(),
        likes: 0,
        comments: 0,
        tags: [],
      }
    );
    setBusy(false);
  };

  return (
    <Modal
      open
      title="Create post"
      description="Share an update with your followers."
      onClose={onClose}
      footer={
        <button onClick={submit} disabled={!caption.trim() || busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FA3728] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />}
          Publish post
        </button>
      }
    >
      <div className="space-y-4">
        <button onClick={() => fileRef.current?.click()} className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-[#FA3728] hover:text-[#FA3728]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Post" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1">
              <ImagePlus size={26} />
              <span className="text-xs font-medium">Add a photo</span>
            </span>
          )}
          {image && (
            <span
              onClick={(e) => { e.stopPropagation(); setImage(null); setFile(null); }}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X size={14} />
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setImage(URL.createObjectURL(f)); }
          }}
        />
        <Field label="Caption" value={caption} onChange={setCaption} textarea rows={3} />
      </div>
    </Modal>
  );
}
