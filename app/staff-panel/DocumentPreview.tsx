'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';

type Doc = Record<string, unknown>;

const str = (d: Doc, keys: string[]) => keys.map((k) => d[k]).find((v) => typeof v === 'string' && v) as string | undefined;

function info(d: Doc) {
  const url = str(d, ['signed_url', 'download_url', 'url', 'link', 'file']);
  const name = str(d, ['filename', 'name', 'original_name']) || 'Document';
  const type = (str(d, ['content_type', 'mime_type']) || '').toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const kind: 'image' | 'pdf' | 'other' =
    type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? 'image' : type === 'application/pdf' || ext === 'pdf' ? 'pdf' : 'other';
  const size = typeof d.size === 'number' ? (d.size > 1048576 ? `${(d.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(d.size / 1024))} KB`) : '';
  return { url, name, kind, size };
}

/** Save the file. Falls back to opening it in a new tab when the storage host blocks cross-origin fetch. */
async function download(url: string, name: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function Viewer({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { url, name, kind } = info(doc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-3 sm:p-6"
    >
      <div className="flex h-full max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-bold text-ink">{name}</p>
          <div className="flex shrink-0 items-center gap-2">
            {url && (
              <button onClick={() => void download(url, name)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50">
                <Download size={13} /> Download
              </button>
            )}
            <button onClick={onClose} aria-label="Close preview" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100">
          {!url || failed ? (
            <p className="px-6 text-center text-sm text-slate-600">
              {failed ? 'This file could not be loaded. The link may have expired: close this and reload the list.' : 'No link was provided for this file.'}
            </p>
          ) : kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
          ) : kind === 'pdf' ? (
            <iframe src={url} title={name} className="h-full w-full border-0" />
          ) : (
            <p className="px-6 text-center text-sm text-slate-600">No preview for this file type. Use Download.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Preview + download for the documents a vendor uploaded with a verification request. */
export default function DocumentPreview({ docs }: { docs: Doc[] }) {
  const [open, setOpen] = useState<Doc | null>(null);
  if (!docs.length) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {docs.map((d, i) => {
          const { url, name, size } = info(d);
          return (
            <div key={str(d, ['id']) ?? i} className="flex items-center gap-1 rounded-xl bg-slate-100 py-1 pl-3 pr-1">
              <FileText size={14} className="shrink-0 text-slate-500" />
              <span className="max-w-[12rem] truncate text-xs font-semibold text-ink">{name}</span>
              {size && <span className="text-[11px] text-slate-500">{size}</span>}
              {url ? (
                <>
                  <button onClick={() => setOpen(d)} aria-label={`Preview ${name}`} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-700 hover:bg-white">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => void download(url, name)} aria-label={`Download ${name}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-700 hover:bg-white">
                    <Download size={14} />
                  </button>
                </>
              ) : (
                <span className="px-2 text-[11px] text-amber-700">no link</span>
              )}
            </div>
          );
        })}
      </div>
      {open && <Viewer doc={open} onClose={() => setOpen(null)} />}
    </>
  );
}
