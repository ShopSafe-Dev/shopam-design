'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { variantsService } from '@/lib/api/variants';
import { commerceApi } from '@/lib/api/endpoints/commerce';
import type { AddOn, ProductVariant } from '@/lib/api/types';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { apiError, formatPrice, PRICE_RE, type UIProduct } from './product-form';

type Tab = 'variants' | 'addons';
type Img = { id: string; image_url: string };

const MAX_PICS = 5;
const MAX_PIC_BYTES = 5 * 1024 * 1024;
const PIC_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Picture strip: existing pictures (removable) plus files queued for upload. */
function PicturePicker({
  existing,
  queued,
  onRemoveExisting,
  onQueue,
  onRemoveQueued,
  onError,
}: {
  existing: Img[];
  queued: File[];
  onRemoveExisting: (id: string) => void;
  onQueue: (files: File[]) => void;
  onRemoveQueued: (index: number) => void;
  onError: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef<Map<File, string>>(new Map());
  const urlFor = (f: File) => {
    let u = previews.current.get(f);
    if (!u) {
      u = URL.createObjectURL(f);
      previews.current.set(f, u);
    }
    return u;
  };
  useEffect(() => {
    const map = previews.current;
    return () => map.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const total = existing.length + queued.length;
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = '';
    const ok = files.filter((f) => PIC_TYPES.includes(f.type) && f.size <= MAX_PIC_BYTES);
    if (ok.length !== files.length) onError('Pictures must be JPEG, PNG or WebP, up to 5 MB each.');
    const room = MAX_PICS - total;
    if (ok.length > room) onError(`At most ${MAX_PICS} pictures.`);
    if (ok.length) onQueue(ok.slice(0, Math.max(room, 0)));
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-600">Pictures ({total}/{MAX_PICS})</p>
      <div className="flex flex-wrap gap-2">
        {existing.map((img) => (
          <Thumb key={img.id} src={img.image_url} onRemove={() => onRemoveExisting(img.id)} />
        ))}
        {queued.map((f, i) => (
          <Thumb key={`${f.name}-${i}`} src={urlFor(f)} onRemove={() => onRemoveQueued(i)} />
        ))}
        {total < MAX_PICS && (
          <button type="button" onClick={() => input.current?.click()} className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-[#FA3728] hover:text-[#FA3728]">
            <ImagePlus size={16} />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
    </div>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={onRemove} aria-label="Remove picture" className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black">
        <X size={11} strokeWidth={3} />
      </button>
    </div>
  );
}
type AttrRow = { key: string; value: string };

const PRESET_KEYS = ['size', 'color', 'material'];

export default function ProductOptionsModal({
  product,
  onClose,
  onChanged,
}: {
  product: UIProduct | null;
  onClose: () => void;
  /** Called after any change so the listing can refresh its counts. */
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>('variants');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    setError('');
    try {
      const [v, a] = await Promise.all([variantsService.list(product.id), commerceApi.productsAddonsList(product.id)]);
      setVariants(v);
      setAddons(Array.isArray(a) ? (a as unknown as AddOn[]) : []);
    } catch (e) {
      setError(apiError(e, 'Could not load options.'));
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (product) {
      setTab('variants');
      void load();
    }
  }, [product, load]);

  return (
    <Modal open={!!product} title="Options" description={product?.title} onClose={onClose}>
      <div className="mb-4 flex gap-1 rounded-full bg-slate-100 p-1">
        {(['variants', 'addons'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition-colors ${tab === t ? 'bg-ink text-white' : 'text-slate-600 hover:text-ink'}`}
          >
            {t === 'variants' ? `Variants (${variants.length})` : `Add-ons (${addons.length})`}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : product && tab === 'variants' ? (
        <VariantsPane product={product} variants={variants} onChange={() => { void load(); onChanged(); }} />
      ) : product ? (
        <AddOnsPane product={product} addons={addons} onChange={() => { void load(); onChanged(); }} />
      ) : null}
    </Modal>
  );
}

/* ── Variants ───────────────────────────────────────────────── */

function VariantsPane({ product, variants, onChange }: { product: UIProduct; variants: ProductVariant[]; onChange: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<AttrRow[]>([{ key: 'size', value: '' }]);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [keptPics, setKeptPics] = useState<Img[]>([]);
  const [queuedPics, setQueuedPics] = useState<File[]>([]);
  const [removedPics, setRemovedPics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEditingId(null);
    setAttrs([{ key: 'size', value: '' }]);
    setPrice('');
    setStock('');
    setSku('');
    setKeptPics([]);
    setQueuedPics([]);
    setRemovedPics([]);
    setError('');
  };

  const edit = (v: ProductVariant) => {
    setEditingId(v.id);
    setAttrs(Object.entries(v.attributes).map(([key, value]) => ({ key, value })));
    setPrice(v.price_override ? String(parseFloat(v.price_override)) : '');
    setStock(v.stock_quantity !== undefined ? String(v.stock_quantity) : '');
    setSku(v.sku ?? '');
    setKeptPics(v.images ?? []);
    setQueuedPics([]);
    setRemovedPics([]);
    setError('');
  };

  const save = async () => {
    setError('');
    const clean = attrs.map((a) => ({ key: a.key.trim().toLowerCase(), value: a.value.trim() })).filter((a) => a.key || a.value);
    if (!clean.length || clean.some((a) => !a.key || !a.value)) return setError('Fill in every attribute name and value.');
    if (new Set(clean.map((a) => a.key)).size !== clean.length) return setError('Each attribute name can only be used once.');
    if (price.trim() && (!PRICE_RE.test(price.trim()) || Number(price) <= 0)) return setError('Price: a positive amount with up to 2 decimals, or leave empty to use the product price.');
    if (stock.trim() && !/^\d+$/.test(stock.trim())) return setError('Stock: a whole number, 0 or more.');

    const body = {
      attributes: Object.fromEntries(clean.map((a) => [a.key, a.value])),
      sku: sku.trim() || null,
      price_override: price.trim() || null,
      ...(stock.trim() ? { stock_quantity: Number(stock) } : {}),
    };
    setBusy(true);
    try {
      const saved = editingId
        ? await variantsService.update(product.id, editingId, body)
        : await variantsService.create(product.id, body);
      // Pictures go through their own endpoint. The variant is already saved, so a failure here is reported but not fatal.
      try {
        for (const id of removedPics) await variantsService.removeImage(product.id, saved.id, id);
        if (queuedPics.length) await variantsService.addImages(product.id, saved.id, queuedPics);
      } catch (picErr) {
        onChange();
        setEditingId(saved.id);
        setQueuedPics([]);
        setRemovedPics([]);
        setError(`Variant saved, but the pictures did not upload: ${apiError(picErr, 'try again')}`);
        return;
      }
      reset();
      onChange();
    } catch (e) {
      setError(apiError(e, 'Could not save the variant.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: ProductVariant) => {
    setError('');
    try {
      await variantsService.remove(product.id, v.id);
      if (editingId === v.id) reset();
      onChange();
    } catch (e) {
      setError(apiError(e, 'Could not delete the variant.'));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Variants are the choices buyers pick from, such as size or colour. Once a product has variants, stock and an optional price are set per variant.
      </p>

      {variants.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3.5 py-3">
              {v.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.images[0].image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{v.label}</p>
                <p className="text-xs text-slate-500">
                  {v.price_override ? formatPrice(v.price_override) : `${formatPrice(product.price)} (product price)`}
                  {' • '}
                  {v.stock_quantity !== undefined ? (v.stock_quantity === 0 ? 'Out of stock' : `${v.stock_quantity} in stock`) : v.in_stock ? 'In stock' : 'Out of stock'}
                </p>
              </div>
              <button type="button" onClick={() => edit(v)} aria-label="Edit variant" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-ink hover:text-ink"><Pencil size={13} /></button>
              <button type="button" onClick={() => remove(v)} aria-label="Delete variant" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200 p-3.5">
        <p className="text-xs font-bold text-ink">{editingId ? 'Edit variant' : 'New variant'}</p>
        {attrs.map((a, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-2/5">
              <input
                list="variant-keys"
                value={a.key}
                onChange={(e) => setAttrs((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                placeholder="size"
                aria-label="Attribute name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
              />
            </div>
            <input
              value={a.value}
              onChange={(e) => setAttrs((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
              placeholder="XL"
              aria-label="Attribute value"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
            {attrs.length > 1 && (
              <button type="button" onClick={() => setAttrs((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove attribute" className="mt-1.5 text-slate-400 hover:text-red-600"><X size={16} /></button>
            )}
          </div>
        ))}
        <datalist id="variant-keys">{PRESET_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
        {attrs.length < 4 && (
          <button type="button" onClick={() => setAttrs((rows) => [...rows, { key: '', value: '' }])} className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-ink"><Plus size={12} /> Add attribute</button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₦, optional)" value={price} onChange={setPrice} inputMode="decimal" />
          <Field label="Stock" value={stock} onChange={setStock} inputMode="numeric" />
        </div>
        <Field label="SKU (optional)" value={sku} onChange={setSku} />
        <PicturePicker
          existing={keptPics}
          queued={queuedPics}
          onRemoveExisting={(id) => { setKeptPics((k) => k.filter((x) => x.id !== id)); setRemovedPics((r) => [...r, id]); }}
          onQueue={(f) => setQueuedPics((q) => [...q, ...f])}
          onRemoveQueued={(i) => setQueuedPics((q) => q.filter((_, j) => j !== i))}
          onError={setError}
        />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} {editingId ? 'Save variant' : 'Add variant'}
          </button>
          {editingId && <button type="button" onClick={reset} className="rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

/* ── Add-ons ────────────────────────────────────────────────── */

function AddOnsPane({ product, addons, onChange }: { product: UIProduct; addons: AddOn[]; onChange: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [keptPics, setKeptPics] = useState<Img[]>([]);
  const [queuedPics, setQueuedPics] = useState<File[]>([]);
  const [removedPics, setRemovedPics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setPrice('');
    setKeptPics([]);
    setQueuedPics([]);
    setRemovedPics([]);
    setError('');
  };

  const edit = (a: AddOn) => {
    setEditingId(a.id);
    setTitle(a.title);
    setDescription(a.description ?? '');
    setPrice(String(parseFloat(a.price)));
    setKeptPics(a.images ?? []);
    setQueuedPics([]);
    setRemovedPics([]);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!title.trim()) return setError('Give the add-on a name.');
    if (!PRICE_RE.test(price.trim()) || Number(price) < 0) return setError('Price: an amount with up to 2 decimals (0 for free).');
    // Multipart so pictures travel with the fields (the add-on endpoint takes uploaded_images / deleted_image_ids).
    const body = new FormData();
    body.append('title', title.trim());
    body.append('description', description.trim());
    body.append('price', price.trim());
    body.append('tax_inclusive', 'false');
    queuedPics.forEach((f) => body.append('uploaded_images', f));
    removedPics.forEach((id) => body.append('deleted_image_ids', id));
    setBusy(true);
    try {
      if (editingId) await commerceApi.productsAddonsPartialUpdate(editingId, product.id, body);
      else await commerceApi.productsAddonsCreate(product.id, body);
      reset();
      onChange();
    } catch (e) {
      setError(apiError(e, 'Could not save the add-on.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: AddOn) => {
    setError('');
    try {
      await commerceApi.productsAddonsDestroy(a.id, product.id);
      if (editingId === a.id) reset();
      onChange();
    } catch (e) {
      setError(apiError(e, 'Could not delete the add-on.'));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">Add-ons are optional extras buyers can tick, such as gift wrapping. Each one adds its price to the item.</p>

      {addons.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {addons.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
              {a.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.images[0].image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                <p className="truncate text-xs text-slate-500">+{formatPrice(a.price)}{a.description ? ` • ${a.description}` : ''}</p>
              </div>
              <button type="button" onClick={() => edit(a)} aria-label="Edit add-on" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-ink hover:text-ink"><Pencil size={13} /></button>
              <button type="button" onClick={() => remove(a)} aria-label="Delete add-on" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200 p-3.5">
        <p className="text-xs font-bold text-ink">{editingId ? 'Edit add-on' : 'New add-on'}</p>
        <Field label="Name" value={title} onChange={setTitle} />
        <Field label="Description (optional)" value={description} onChange={(v) => setDescription(v.slice(0, 500))} />
        <Field label="Price (₦)" value={price} onChange={setPrice} inputMode="decimal" />
        <PicturePicker
          existing={keptPics}
          queued={queuedPics}
          onRemoveExisting={(id) => { setKeptPics((k) => k.filter((x) => x.id !== id)); setRemovedPics((r) => [...r, id]); }}
          onQueue={(f) => setQueuedPics((q) => [...q, ...f])}
          onRemoveQueued={(i) => setQueuedPics((q) => q.filter((_, j) => j !== i))}
          onError={setError}
        />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} {editingId ? 'Save add-on' : 'Add add-on'}
          </button>
          {editingId && <button type="button" onClick={reset} className="rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>}
        </div>
      </div>
    </div>
  );
}
