'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, ShoppingBag } from 'lucide-react';
import { cartService } from '@/lib/api';
import { money } from '@/lib/order-steps';
import type { PostProduct } from './data';

type State = 'idle' | 'busy' | 'added' | 'error';

function ProductRow({ product, canAdd }: { product: PostProduct; canAdd: boolean }) {
  const [state, setState] = useState<State>('idle');
  const href = `/products/${product.id}`;

  const add = async () => {
    setState('busy');
    try {
      await cartService.addToCart({ product_id: product.id, quantity: 1 });
      window.dispatchEvent(new Event('shopam:cart-updated'));
      setState('added');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5">
      <Link href={href} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {product.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </Link>
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">{product.title}</p>
        <p className="text-[13px] font-black text-ink">{money(Number(product.price) || 0)}</p>
      </Link>
      {!product.inStock ? (
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">Sold out</span>
      ) : state === 'added' ? (
        <Link href="/cart" className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <Check size={13} /> View cart
        </Link>
      ) : canAdd && !product.hasOptions ? (
        <button
          type="button"
          onClick={() => void add()}
          disabled={state === 'busy'}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#FA3728] disabled:opacity-60"
        >
          {state === 'busy' ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
          {state === 'error' ? 'Try again' : 'Add to cart'}
        </button>
      ) : (
        <Link href={href} className="shrink-0 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-ink">
          {product.hasOptions ? 'Choose options' : 'View'}
        </Link>
      )}
    </div>
  );
}

/** Products the vendor tagged on a post. One tap adds a plain product to the cart; products with options open their page. */
export default function PostProducts({ products, canAdd }: { products: PostProduct[]; canAdd: boolean }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Shop this post</p>
      {products.map((p) => (
        <ProductRow key={p.id} product={p} canAdd={canAdd} />
      ))}
    </div>
  );
}
