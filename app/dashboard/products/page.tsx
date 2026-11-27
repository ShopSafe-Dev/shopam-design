'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveRefresh } from '@/lib/live/useLiveRefresh';
import { motion } from 'framer-motion';
import { Loader2, Package, Plus, Search } from 'lucide-react';
import { productsService, categoriesService } from '@/lib/api/products';
import { commerceApi } from '@/lib/api/endpoints/commerce';
import Modal from '../components/Modal';
import Field from '../components/Field';
import ProductCard from './ProductCard';
import ProductFormModal from './ProductFormModal';
import ProductOptionsModal from './ProductOptionsModal';
import { apiError, buildTree, formatPrice, type CatNode, type UIProduct } from './product-form';

type TypeFilter = 'all' | 'product' | 'service';
type Sort = 'newest' | 'price_asc' | 'price_desc' | 'name';

export default function ProductsPage() {
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const [tree, setTree] = useState<CatNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UIProduct | null>(null);

  const [optionsFor, setOptionsFor] = useState<UIProduct | null>(null);
  const [stockFor, setStockFor] = useState<UIProduct | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [stockBusy, setStockBusy] = useState(false);
  const [stockError, setStockError] = useState('');

  const [deleting, setDeleting] = useState<UIProduct | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const data = await productsService.getMyProducts();
      // Keep stock numbers learned this session: the API does not return stock.
      setProducts((prev) => {
        const known = new Map(prev.map((p) => [p.id, p.localStock]));
        return (Array.isArray(data) ? data : []).map((p) => ({ ...p, localStock: known.get(p.id) }));
      });
    } catch (err) {
      if (!silent) setLoadError(apiError(err, 'Could not load your products.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Stock changes from sales show up without a reload.
  useLiveRefresh(() => load(true), { enabled: !loading, topics: ['product'] });

  useEffect(() => {
    void load();
    categoriesService
      .getCategories()
      .then((c) => setTree(buildTree(c)))
      .finally(() => setTreeLoading(false));
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (type === 'all' || p.item_type === type) &&
        (!term || p.title.toLowerCase().includes(term) || (p.taxonomy_path ?? '').toLowerCase().includes(term))
    );
    const price = (p: UIProduct) => parseFloat(p.price) || 0;
    return [...list].sort((a, b) =>
      sort === 'price_asc' ? price(a) - price(b)
      : sort === 'price_desc' ? price(b) - price(a)
      : sort === 'name' ? a.title.localeCompare(b.title)
      : +new Date(b.created_at) - +new Date(a.created_at)
    );
  }, [products, q, type, sort]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: UIProduct) => { setEditing(p); setFormOpen(true); };

  const onSaved = (saved: UIProduct, warning?: string) => {
    setProducts((prev) => (prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
    setNotice(warning ?? '');
  };

  const openStock = (p: UIProduct) => {
    setStockFor(p);
    setStockValue(p.localStock !== undefined ? String(p.localStock) : '');
    setStockError('');
  };

  const saveStock = async () => {
    if (!stockFor || stockBusy) return;
    if (!/^\d+$/.test(stockValue.trim())) return setStockError('Enter a whole number, 0 or more.');
    setStockBusy(true);
    setStockError('');
    try {
      const res = await commerceApi.productsUpdateStockPartialUpdate(stockFor.id, { stock_quantity: Number(stockValue) });
      const n = typeof res?.stock_quantity === 'number' ? res.stock_quantity : Number(stockValue);
      setProducts((prev) => prev.map((p) => (p.id === stockFor.id ? { ...p, localStock: n } : p)));
      setStockFor(null);
    } catch (err) {
      setStockError(apiError(err, 'Could not update the stock.'));
    } finally {
      setStockBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await productsService.deleteProduct(deleting.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setDeleteError(apiError(err, 'Could not delete this listing.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const chip = (value: TypeFilter, label: string) => (
    <button
      key={value}
      onClick={() => setType(value)}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${type === value ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink md:text-3xl">Products</h1>
          <p className="mt-0.5 text-sm text-slate-600">{loading ? 'Loading…' : `${products.length} listing${products.length === 1 ? '' : 's'}`}</p>
        </div>
        <button onClick={openAdd} className="flex shrink-0 items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#FA3728]/25 transition-colors hover:bg-[#E31B23]">
          <Plus size={16} strokeWidth={2.5} /> Add listing
        </button>
      </motion.div>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          {notice}
          <button onClick={() => setNotice('')} className="shrink-0 font-bold">Dismiss</button>
        </div>
      )}

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chip('all', 'All')}{chip('product', 'Products')}{chip('service', 'Services')}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or category"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-slate-400 focus:border-ink"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink outline-none focus:border-ink"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#FA3728]" /></div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {loadError}
          <button onClick={() => load()} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-200">Retry</button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FA3728]/10 text-[#FA3728]"><Package size={26} /></span>
          <p className="mt-4 text-base font-bold text-ink">Your shop is empty</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">Add your first product or service. Photos and a category help buyers find it.</p>
          <button onClick={openAdd} className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#FA3728]">
            <Plus size={15} strokeWidth={2.5} /> Add listing
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">Nothing matches your filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} onEdit={() => openEdit(p)} onStock={() => openStock(p)} onOptions={() => setOptionsFor(p)} onDelete={() => { setDeleting(p); setDeleteError(''); }} />
          ))}
        </div>
      )}

      <ProductOptionsModal product={optionsFor} onClose={() => setOptionsFor(null)} onChanged={() => void load(true)} />

      <ProductFormModal
        open={formOpen}
        product={editing}
        tree={tree}
        treeLoading={treeLoading}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
      />

      <Modal
        open={!!stockFor}
        title="Update stock"
        description={stockFor?.title}
        onClose={() => !stockBusy && setStockFor(null)}
        footer={
          <button onClick={saveStock} disabled={stockBusy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FA3728] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-60">
            {stockBusy && <Loader2 size={16} className="animate-spin" />} Save stock
          </button>
        }
      >
        <div className="space-y-3">
          <Field label="Quantity available" value={stockValue} onChange={setStockValue} inputMode="numeric" error={stockError} />
          <p className="text-[11px] text-slate-500">Set to 0 when it sells out.</p>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        title="Delete this listing?"
        onClose={() => !deleteBusy && setDeleting(null)}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setDeleting(null)} disabled={deleteBusy} className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-bold text-ink transition-colors hover:border-ink disabled:opacity-60">Keep it</button>
            <button onClick={confirmDelete} disabled={deleteBusy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60">
              {deleteBusy && <Loader2 size={15} className="animate-spin" />} Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-ink">{deleting?.title}</span> ({deleting ? formatPrice(deleting.price) : ''}) will be removed from your shop.
        </p>
        {deleteError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{deleteError}</p>}
      </Modal>
    </div>
  );
}
