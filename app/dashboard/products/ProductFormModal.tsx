'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { productsService } from '@/lib/api/products';
import { commerceApi } from '@/lib/api/endpoints/commerce';
import type { ItemType } from '@/lib/api/types';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Switch from '../components/Switch';
import CategoryPicker from './CategoryPicker';
import {
  apiError,
  findByTaxonomyPath,
  MAX_DESCRIPTION,
  MAX_IMAGES,
  PRICE_RE,
  type CatNode,
  type UIProduct,
} from './product-form';

interface NewImage {
  file: File;
  preview: string;
}

type Errors = Partial<Record<'title' | 'price' | 'stock' | 'category' | 'images', string>>;

export default function ProductFormModal({
  open,
  product,
  tree,
  treeLoading,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = create, a product = edit */
  product: UIProduct | null;
  tree: CatNode[];
  treeLoading: boolean;
  onClose: () => void;
  onSaved: (product: UIProduct, warning?: string) => void;
}) {
  const editing = !!product;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [itemType, setItemType] = useState<ItemType>('product');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [kept, setKept] = useState<{ id: string; url: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<NewImage[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const matchedCategory = useRef(false);

  // Load the form each time it opens.
  useEffect(() => {
    if (!open) return;
    matchedCategory.current = false;
    setTitle(product?.title ?? '');
    setDescription(product?.description ?? '');
    setPrice(product ? String(parseFloat(product.price)) : '');
    setStock(product?.localStock !== undefined ? String(product.localStock) : '');
    setItemType(product?.item_type ?? 'product');
    setTaxInclusive(!!product?.tax_inclusive);
    setCategoryId('');
    setKept((product?.images ?? []).map((i) => ({ id: i.id, url: i.image_url })));
    setRemoved([]);
    setAdded([]);
    setErrors({});
    setFormError('');
  }, [open, product]);

  // Edit: products return the category as text, so match it back to a tree node once the tree is ready.
  useEffect(() => {
    if (!open || !product || matchedCategory.current || !tree.length) return;
    matchedCategory.current = true;
    const node = findByTaxonomyPath(tree, product.taxonomy_path);
    if (node?.leaf) setCategoryId(node.id);
  }, [open, product, tree]);

  useEffect(() => () => added.forEach((a) => URL.revokeObjectURL(a.preview)), [added]);

  const total = kept.length + added.length;
  const coverUrl = useMemo(() => kept[0]?.url ?? added[0]?.preview, [kept, added]);

  const pickFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - total;
    if (files.length > room) setErrors((e) => ({ ...e, images: `You can add ${MAX_IMAGES} images at most.` }));
    else setErrors((e) => ({ ...e, images: undefined }));
    setAdded((a) => [...a, ...files.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Give it a name.';
    else if (title.trim().length > 255) e.title = 'Keep the name under 255 characters.';
    if (!price.trim()) e.price = 'Enter a price.';
    else if (!PRICE_RE.test(price.trim()) || Number(price) <= 0) e.price = 'Use a positive amount with up to 2 decimals.';
    if (stock.trim() && !/^\d+$/.test(stock.trim())) e.stock = 'Whole number, 0 or more.';
    return e;
  };

  const submit = async () => {
    if (busy) return;
    const e = validate();
    setErrors(e);
    setFormError('');
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const files = added.map((a) => a.file);
      let saved: UIProduct;
      if (product) {
        saved = await productsService.updateProduct(product.id, {
          title: title.trim(),
          description: description.trim(),
          price: price.trim(),
          item_type: itemType,
          tax_inclusive: taxInclusive,
          taxonomy_id: categoryId || undefined,
          images: files.length ? files : undefined,
          deleted_image_ids: removed.length ? removed : undefined,
        });
      } else {
        saved = await productsService.createProduct({
          title: title.trim(),
          description: description.trim() || undefined,
          price: price.trim(),
          item_type: itemType,
          tax_inclusive: taxInclusive,
          taxonomy_id: categoryId || undefined,
          images: files.length ? files : undefined,
        });
      }

      // Stock is a separate endpoint, and only sent when it was entered or changed.
      let warning: string | undefined;
      const n = stock.trim() === '' ? undefined : Number(stock);
      if (n !== undefined && n !== product?.localStock) {
        try {
          await commerceApi.productsUpdateStockPartialUpdate(saved.id, { stock_quantity: n });
          saved = { ...saved, localStock: n };
        } catch (err) {
          warning = `Saved, but the stock quantity was not updated: ${apiError(err, 'try again from the stock button')}`;
          saved = { ...saved, localStock: product?.localStock };
        }
      } else if (product?.localStock !== undefined) {
        saved = { ...saved, localStock: product.localStock };
      }
      onSaved(saved, warning);
      onClose();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setFormError(
        status === 403
          ? apiError(err, 'Your vendor account is not set up to list products yet. Finish your business verification or contact support.')
          : apiError(err, editing ? 'Could not save your changes.' : 'Could not create the product.')
      );
    } finally {
      setBusy(false);
    }
  };

  const typeBtn = (t: ItemType, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setItemType(t)}
      className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition-colors ${itemType === t ? 'bg-ink text-white' : 'text-slate-600 hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      open={open}
      title={editing ? 'Edit listing' : 'Add a listing'}
      description={editing ? 'Changes go live as soon as you save.' : 'Create a product or service for your shop.'}
      onClose={() => !busy && onClose()}
      footer={
        <button
          onClick={submit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FA3728] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
        </button>
      }
    >
      <div className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">{formError}</div>
        )}

        {/* Images */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-semibold text-slate-600">Photos</p>
            <p className="text-[11px] text-slate-500">{total}/{MAX_IMAGES}</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {kept.map((img, i) => (
              <Thumb key={img.id} src={img.url} cover={i === 0} onRemove={() => { setKept((k) => k.filter((x) => x.id !== img.id)); setRemoved((r) => [...r, img.id]); }} />
            ))}
            {added.map((img, i) => (
              <Thumb key={img.preview} src={img.preview} cover={kept.length === 0 && i === 0} onRemove={() => setAdded((a) => a.filter((x) => x !== img))} />
            ))}
            {total < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-[#FA3728] hover:text-[#FA3728]"
              >
                <ImagePlus size={20} />
                <span className="text-[11px] font-medium">{total === 0 ? 'Add photos' : 'Add'}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          <p className={`mt-1.5 text-[11px] ${errors.images ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            {errors.images ?? (coverUrl ? 'The first photo is the cover shown in listings.' : 'Listings with photos stand out.')}
          </p>
        </div>

        <Field label="Name" value={title} onChange={setTitle} error={errors.title} />
        <div>
          <Field label="Description" value={description} onChange={(v) => setDescription(v.slice(0, MAX_DESCRIPTION))} textarea rows={4} />
          <p className="mt-1 px-1 text-right text-[11px] text-slate-500">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">What are you listing?</p>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">{typeBtn('product', 'Product')}{typeBtn('service', 'Service')}</div>
        </div>

        <CategoryPicker tree={tree} loading={treeLoading} value={categoryId} onChange={setCategoryId} error={errors.category} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₦)" value={price} onChange={setPrice} inputMode="decimal" error={errors.price} />
          <Field label={itemType === 'service' ? 'Slots available' : 'Stock quantity'} value={stock} onChange={setStock} inputMode="numeric" error={errors.stock} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Price includes tax</p>
            <p className="mt-0.5 text-xs text-slate-600">Turn on if buyers should not pay tax on top.</p>
          </div>
          <Switch checked={taxInclusive} onChange={() => setTaxInclusive((v) => !v)} />
        </div>
      </div>
    </Modal>
  );
}

function Thumb({ src, cover, onRemove }: { src: string; cover: boolean; onRemove: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {cover && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black"
      >
        <X size={12} strokeWidth={3} />
      </button>
    </div>
  );
}
