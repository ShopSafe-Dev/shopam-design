import { ImageIcon, Pencil, Trash2, Boxes, Star, SlidersHorizontal } from 'lucide-react';
import { formatPrice, type UIProduct } from './product-form';

export default function ProductCard({
  product,
  onEdit,
  onStock,
  onOptions,
  onDelete,
}: {
  product: UIProduct;
  onEdit: () => void;
  onStock: () => void;
  onOptions: () => void;
  onDelete: () => void;
}) {
  const cover = product.images?.[0]?.image_url;
  const rating = parseFloat(product.average_rating);
  const reviews = parseInt(product.review_count);
  const category = product.taxonomy_path ? product.taxonomy_path.split(/\s*(?:>|›|»|→|\/)\s*/).filter(Boolean).slice(-2).join(' › ') : '';
  const stock = product.localStock;
  const variantCount = product.variants?.length ?? 0;
  const addonCount = product.addons?.length ?? 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={product.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-300">
            <ImageIcon size={30} />
            <span className="text-[11px] font-medium">No photo</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold capitalize text-ink backdrop-blur">{product.item_type}</span>
        {product.images.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{product.images.length} photos</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {category ? (
          <span className="mb-1.5 w-fit max-w-full truncate rounded-full bg-[#FA3728]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FA3728]">{category}</span>
        ) : (
          <span className="mb-1.5 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">No category</span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink">{product.title}</h3>
        <p className="mt-1 text-base font-black text-ink">
          {formatPrice(product.price)}
          {product.tax_inclusive && <span className="ml-1.5 text-[10px] font-medium text-slate-500">incl. tax</span>}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-600">
          {stock !== undefined && (
            <span className={`flex items-center gap-1 ${stock === 0 ? 'text-red-600' : stock <= 5 ? 'text-amber-600' : ''}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${stock === 0 ? 'bg-red-500' : stock <= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {stock === 0 ? 'Out of stock' : `${stock} in stock`}
            </span>
          )}
          {(variantCount > 0 || addonCount > 0) && (
            <span>{[variantCount > 0 && `${variantCount} variant${variantCount === 1 ? '' : 's'}`, addonCount > 0 && `${addonCount} add-on${addonCount === 1 ? '' : 's'}`].filter(Boolean).join(' • ')}</span>
          )}
          {rating > 0 && (
            <span className="flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400" />{rating.toFixed(1)}{reviews > 0 && ` (${reviews})`}</span>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-3.5">
          <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-xs font-semibold text-ink transition-colors hover:border-ink">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={onOptions} aria-label="Variants and add-ons" title="Variants and add-ons" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-ink hover:text-ink">
            <SlidersHorizontal size={14} />
          </button>
          <button onClick={onStock} aria-label="Update stock" title="Update stock" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-ink hover:text-ink">
            <Boxes size={14} />
          </button>
          <button onClick={onDelete} aria-label="Delete" title="Delete" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
