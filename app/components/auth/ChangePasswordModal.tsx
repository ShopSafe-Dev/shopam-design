'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/lib/api';
import Modal from '@/app/components/ui/Modal';
import Field from '@/app/components/ui/Field';

const MIN_LENGTH = 8; // matches the reset-password rule

function errorText(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string') return d.message;
    if (typeof d.detail === 'string') return d.detail;
    const flat = Object.values(d).flat().filter((v) => typeof v === 'string');
    if (flat.length) return flat.join(' ');
  }
  return 'Could not change password. Check your current password.';
}

/** Change password for the signed-in user (customer or vendor). Session stays active. */
export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ current: '', next: '', confirm: '' });
      setError('');
      setDone(false);
    }
  }, [open]);

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!form.current) return setError('Enter your current password.');
    if (form.next.length < MIN_LENGTH) return setError(`New password must be at least ${MIN_LENGTH} characters.`);
    if (form.next === form.current) return setError('New password must be different from your current one.');
    if (form.next !== form.confirm) return setError('New passwords do not match.');

    setBusy(true);
    try {
      await authService.changePassword({ old_password: form.current, new_password: form.next });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const primary =
    'flex w-full items-center justify-center gap-2 rounded-full bg-[#FA3728] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-60';

  return (
    <Modal
      open={open}
      title="Change password"
      onClose={onClose}
      footer={
        done ? (
          <button onClick={onClose} className={primary}>
            Done
          </button>
        ) : (
          <button onClick={submit} disabled={busy} className={primary}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            Update password
          </button>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-emerald-500" />
          <p className="text-sm text-slate-600">Your password has been updated.</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
              {error}
            </div>
          )}
          <Field label="Current password" type="password" value={form.current} onChange={(v) => setForm({ ...form, current: v })} autoComplete="current-password" />
          <Field label="New password" type="password" value={form.next} onChange={(v) => setForm({ ...form, next: v })} autoComplete="new-password" hint={`At least ${MIN_LENGTH} characters`} />
          <Field label="Confirm new password" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
