'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { flattenTree, type CatNode } from './product-form';

/**
 * Category field with an inline panel: search any category by name, or drill down the tree.
 * Only leaf categories can be chosen (a parent is just a folder).
 */
export default function CategoryPicker({
  tree,
  loading,
  value,
  onChange,
  error,
}: {
  tree: CatNode[];
  loading: boolean;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [trail, setTrail] = useState<CatNode[]>([]);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const selected = useMemo(() => flat.find((n) => n.id === value), [flat, value]);

  const term = q.trim().toLowerCase();
  const results = useMemo(
    () => (term ? flat.filter((n) => n.leaf && n.path.join(' ').toLowerCase().includes(term)).slice(0, 40) : []),
    [flat, term]
  );
  const level = trail.length ? trail[trail.length - 1].children : tree;

  const choose = (n: CatNode) => {
    onChange(n.id);
    setOpen(false);
    setQ('');
    setTrail([]);
  };

  const row = (n: CatNode, label: React.ReactNode) => {
    const active = n.id === value;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => (n.leaf ? choose(n) : setTrail((t) => [...t, n]))}
        className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${active ? 'bg-[#FA3728]/5 font-semibold text-[#FA3728]' : 'text-ink'}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        {n.leaf ? active && <Check size={15} /> : <ChevronRight size={15} className="shrink-0 text-slate-400" />}
      </button>
    );
  };

  return (
    <div>
      <div className={`rounded-2xl border-2 bg-white transition-colors ${error ? 'border-red-300' : open ? 'border-ink' : 'border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={loading}
          className="relative flex w-full items-center justify-between gap-3 px-4 pb-2 pt-6 text-left disabled:opacity-60"
        >
          <span className="pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-slate-600">Category</span>
          <span className={`min-w-0 flex-1 truncate text-[15px] ${selected ? 'text-ink' : 'text-slate-500'}`}>
            {loading ? 'Loading categories…' : selected ? selected.path.join(' › ') : tree.length ? 'Choose where this belongs' : 'No categories available'}
          </span>
          {loading ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>

        {open && (
          <div className="border-t border-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search categories"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-slate-400 hover:text-ink">
                  <X size={14} />
                </button>
              )}
            </div>

            {!term && trail.length > 0 && (
              <button
                type="button"
                onClick={() => setTrail((t) => t.slice(0, -1))}
                className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3.5 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft size={14} /> {trail.map((n) => n.name).join(' › ')}
              </button>
            )}

            <div className="max-h-60 divide-y divide-slate-50 overflow-y-auto">
              {term ? (
                results.length ? (
                  results.map((n) =>
                    row(
                      n,
                      <>
                        <span className="text-slate-500">{n.path.slice(0, -1).join(' › ')}{n.path.length > 1 ? ' › ' : ''}</span>
                        <span className="font-semibold">{n.name}</span>
                      </>
                    )
                  )
                ) : (
                  <p className="px-3.5 py-6 text-center text-sm text-slate-500">No category matches &ldquo;{q}&rdquo;.</p>
                )
              ) : level.length ? (
                level.map((n) => row(n, n.name))
              ) : (
                <p className="px-3.5 py-6 text-center text-sm text-slate-500">No categories available.</p>
              )}
            </div>

            {selected && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full border-t border-slate-100 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
      {error ? <p className="mt-1.5 px-1 text-xs font-medium text-red-600">{error}</p> : <p className="mt-1.5 px-1 text-[11px] text-slate-500">Helps buyers find this in search and browsing.</p>}
    </div>
  );
}
