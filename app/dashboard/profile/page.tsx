'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Loader2, MapPin, Package } from 'lucide-react';
import Link from 'next/link';
import { authService, productsService } from '@/lib/api';
import { useVendorProfile } from '@/lib/vendor/useVendorProfile';
import BusinessCover from '@/app/components/BusinessCover';
import type { ProductService } from '@/lib/api';
import ProductCard from '@/app/explore/components/ProductCard';

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
            <div className="h-40 animate-pulse bg-slate-100 sm:h-56" />
          ) : (
            <BusinessCover name={profile.name} showName={false} className="h-40 sm:h-56" />
          )}
          <div className="relative px-4 pb-4 sm:px-6">
            <div className="relative -mt-12 h-24 w-24 sm:-mt-14 sm:h-28 sm:w-28">
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
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-sm">
              <span><span className="font-black text-ink">{products.length}</span> <span className="text-slate-600">products</span></span>
              <Link href="/dashboard/posts" className="font-semibold text-slate-600 hover:text-[#FA3728]">View your posts</Link>
            </div>
          </div>
        </div>
      )}

      <section>
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
      </section>
    </div>
  );
}
