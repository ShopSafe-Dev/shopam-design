'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';

/**
 * Destructive-action confirmation. The confirm button stays disabled, and onConfirm is
 * never called, until the user types `confirmText` exactly (case-sensitive).
 */
export default function ConfirmTypeModal({
  open,
  title,
  description,
  warning,
  confirmText,
  actionLabel,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  warning: React.ReactNode;
  confirmText: string;
  actionLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed === confirmText;

  // Fresh input every time the dialog opens.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const submit = () => {
    if (!matches || busy) return; // hard guard: API is never reached without the exact phrase
    onConfirm();
  };

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={() => !busy && onClose()}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-full border border-slate-200 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!matches || busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {actionLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            !
          </span>
          <div>{warning}</div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
            {error}
          </div>
        )}

        <label className="block text-sm text-slate-700">
          Type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-ink">{confirmText}</span> to
          confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Type ${confirmText} to confirm`}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          />
        </label>
      </div>
    </Modal>
  );
}
