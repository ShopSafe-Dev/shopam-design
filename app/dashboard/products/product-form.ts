import type { ProductService } from '@/lib/api/types';

/* ── Category tree ───────────────────────────────────────────── */
export interface CatNode {
  id: string;
  name: string;
  path: string[];
  children: CatNode[];
  leaf: boolean;
}

/** Build a typed tree from GET /api/commerce/categories (root nodes with nested `subcategories`). */
export function buildTree(items: unknown, path: string[] = []): CatNode[] {
  if (!Array.isArray(items)) return [];
  const out: CatNode[] = [];
  for (const raw of items) {
    const it = raw as { id?: unknown; name?: unknown; subcategories?: unknown };
    if (!it || it.id == null || it.name == null) continue;
    const p = [...path, String(it.name)];
    const children = buildTree(it.subcategories, p);
    out.push({ id: String(it.id), name: String(it.name), path: p, children, leaf: children.length === 0 });
  }
  return out;
}

export function flattenTree(nodes: CatNode[]): CatNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/**
 * Products only return `taxonomy_path` (text), not the category id. Match that text back to a node:
 * the last segment is the category name; if several share it, prefer the one whose full path matches.
 */
export function findByTaxonomyPath(nodes: CatNode[], taxonomyPath: string | null | undefined): CatNode | undefined {
  if (!taxonomyPath) return undefined;
  const segs = taxonomyPath.split(/\s*(?:>|›|»|→|\/)\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const last = segs[segs.length - 1];
  if (!last) return undefined;
  const hits = flattenTree(nodes).filter((n) => n.name.toLowerCase() === last);
  if (hits.length <= 1) return hits[0];
  const full = segs.join('|');
  return hits.find((n) => n.path.map((s) => s.toLowerCase()).join('|').endsWith(full)) ?? hits[0];
}

/* ── Product UI types ────────────────────────────────────────── */
/** `localStock` is only known for products created or restocked in this session: the API does not return stock. */
export interface UIProduct extends ProductService {
  localStock?: number;
}

export const MAX_IMAGES = 6;
export const MAX_DESCRIPTION = 2000;
export const PRICE_RE = /^\d{1,10}(\.\d{1,2})?$/;

export const formatPrice = (price: string) => {
  const n = parseFloat(price);
  return Number.isFinite(n) ? `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₦-';
};

/** Flatten a DRF error body into one readable line. */
export function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: unknown }; message?: string };
  const data = e?.response?.data;
  if (typeof data === 'string' && data && data.length < 300) return data;
  if (data && typeof data === 'object') {
    const msgs: string[] = [];
    const walk = (v: unknown, key?: string) => {
      if (typeof v === 'string') msgs.push(key && !['detail', 'message', 'error', 'non_field_errors'].includes(key) ? `${key}: ${v}` : v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
    };
    walk(data);
    if (msgs.length) return msgs.join(' ');
  }
  return fallback;
}
