'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';
import { DISPUTE_CATEGORIES, type DisputeCategory } from '@/lib/api/disputes';

const MAX_FILES = 5;
const TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * Raise a dispute on a delivered order: what kind of problem, what happened, photos.
 * `onSubmit` should throw on failure; its message is shown here.
 */
export default function DisputeModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (category: DisputeCategory, details: string, files: File[]) => Promise<void>;
}) {
  const [category, setCategory] = useState<DisputeCategory | ''>('');
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const pick = (list: FileList | null) => {
    setError('');
    const picked = Array.from(list ?? []);
    if (picked.some((f) => !TYPES.includes(f.type))) return setError('Files must be JPG, PNG or PDF.');
    if (picked.some((f) => f.size > 10 * 1024 * 1024)) return setError('Each photo must be 10 MB or smaller.');
    setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = '';
  };

  const ready = !!category && details.trim().length >= 10;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(category as DisputeCategory, details.trim(), files);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not submit the dispute. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Raise a dispute</h2>
            <p className="text-xs text-slate-500">The order goes on hold and our team contacts you. The seller is not paid until we decide.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-slate-600">What went wrong?</p>
        <div className="space-y-1.5">
          {DISPUTE_CATEGORIES.map((option) => {
            const active = category === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setCategory(option.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                  active ? 'bg-slate-900/[0.04] text-ink' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? 'border-ink bg-ink' : 'border-slate-300'}`}>
                  {active && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Describe what happened (at least 10 characters)"
          className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-base text-ink outline-none focus:border-ink sm:text-sm"
        />

        <div className="mt-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink disabled:opacity-50">
            <ImagePlus size={15} /> Add photos or receipts ({files.length}/{MAX_FILES})
          </button>
          <input ref={fileRef} type="file" multiple accept={TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files)} />
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink">
                  <span className="max-w-[9rem] truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, n) => n !== i))} aria-label={`Remove ${f.name}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-200"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={!ready || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#FA3728] disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Submit dispute
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Order never arrived? Disputes are for delivered orders. <Link href="/support" className="font-semibold underline">Contact support</Link> instead.
        </p>
      </motion.div>
    </motion.div>
  );
}
