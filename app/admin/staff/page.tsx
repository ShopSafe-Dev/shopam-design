'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminsApi } from '@/lib/api/endpoints/admins';
import { Card, ErrorBox, PageHeader, btn, errMsg, inputCls } from '../ui';

export default function AdminStaffPage() {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setDone('');
    if (!form.email.trim() || !form.password) return setError('Email and password are required.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');

    setBusy(true);
    try {
      // The spec lists `username` as required but does not define it, so send it when provided.
      const body = {
        email: form.email.trim(),
        password: form.password,
        ...(form.username.trim() ? { username: form.username.trim() } : {}),
      };
      await adminsApi.createStaffCreate(body as Parameters<typeof adminsApi.createStaffCreate>[0]);
      setDone(`Staff account created for ${form.email.trim()}.`);
      setForm({ email: '', username: '', password: '' });
    } catch (err) {
      setError(errMsg(err, 'Could not create the staff account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Staff" subtitle="Create an admin staff account" />
      <Card className="max-w-xl p-5">
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <ErrorBox message={error} />}
          {done && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{done}</div>}
          <label className="block text-sm font-semibold text-ink">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" className={`${inputCls} mt-1.5`} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Username <span className="font-normal text-slate-500">(if your backend requires one)</span>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" className={`${inputCls} mt-1.5`} />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Temporary password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" className={`${inputCls} mt-1.5`} />
          </label>
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy && <Loader2 size={14} className="animate-spin" />} Create staff account
          </button>
        </form>
      </Card>
    </>
  );
}
