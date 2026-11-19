'use client';

import { useRef, useState } from 'react';
import { BadgeCheck, Clock, FileText, ImagePlus, Loader2, Lock, LogOut, Phone, ShieldCheck, Store } from 'lucide-react';
import { authService } from '@/lib/api';
import { accountsApi } from '@/lib/api/endpoints/accounts';
import type { VerificationInfo } from '@/lib/api';
import { useVendorProfile } from '@/lib/vendor/useVendorProfile';
import Field from '../components/Field';
import ChangePasswordModal from '@/app/components/auth/ChangePasswordModal';

const MAX_DOC_BYTES = 10 * 1024 * 1024;

type Kind = 'cac' | 'tin' | 'address';
type State = 'open' | 'pending' | 'verified';

function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string' && data && data.length < 300) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of ['message', 'detail', 'error']) if (typeof d[k] === 'string') return d[k] as string;
    const flat = Object.values(d).flat().filter((v) => typeof v === 'string');
    if (flat.length) return flat.join(' ');
  }
  return fallback;
}

function pickId(res: unknown): string | null {
  const r = (res ?? {}) as Record<string, unknown>;
  const nested = (typeof r.verification === 'object' ? r.verification : r.data) as Record<string, unknown> | undefined;
  const id = nested?.id ?? r.id ?? r.verification_id;
  return typeof id === 'string' ? id : null;
}

function SectionTitle({ icon: Icon, title, note }: { icon: typeof Store; title: string; note?: string }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-ink" />
        <h3 className="text-sm font-bold text-ink">{title}</h3>
      </div>
      {note && <p className="mt-1 text-xs text-slate-600">{note}</p>}
    </div>
  );
}

function StatusBadge({ state }: { state: State | 'locked' }) {
  if (state === 'verified')
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><BadgeCheck size={12} /> Verified</span>;
  if (state === 'pending')
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><Clock size={12} /> Pending review</span>;
  if (state === 'locked')
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"><Lock size={12} /> Locked</span>;
  return null;
}

/** A read-only detail: set once, only staff can change it. */
function LockedRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-ink">{value || 'Not set'}</p>
        <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      </div>
      <StatusBadge state="locked" />
    </div>
  );
}

function VerifyRow({
  kind,
  label,
  initial,
  verified,
  info,
  textarea,
  withDocument,
  inputMode,
}: {
  kind: Kind;
  label: string;
  initial: string;
  verified: boolean;
  info?: VerificationInfo;
  textarea?: boolean;
  withDocument?: boolean;
  inputMode?: 'text' | 'numeric';
}) {
  const [value, setValue] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Server state wins. Pending and approved lock the section; rejected and missing stay editable.
  const server = (info?.status ?? '').toLowerCase();
  const state: State =
    verified || server === 'approved' || server === 'verified'
      ? 'verified'
      : submitted || server === 'pending'
        ? 'pending'
        : 'open';
  const rejected = server === 'rejected';
  const locked = state !== 'open';

  const pick = (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (f.size > MAX_DOC_BYTES) return setError('That file is over 10 MB.');
    setFile(f);
  };

  const submit = async () => {
    setError('');
    setNote('');
    const v = value.trim();
    if (!v) return setError(`Enter your ${label.toLowerCase()}.`);
    if (withDocument && !file) return setError('Attach the document first.');
    setBusy(true);
    try {
      const body =
        kind === 'cac' ? { verification_type: kind, cac_number: v } : kind === 'tin' ? { verification_type: kind, tin_number: v } : { verification_type: kind, address: v };
      const res = await accountsApi.submitVerificationCreate(body);
      setSubmitted(true); // the server locks this section as soon as the submit succeeds
      if (withDocument && file) {
        const id = pickId(res);
        if (!id) {
          setNote('Submitted. The server did not return a verification id, so the document could not be attached. Contact support.');
        } else {
          try {
            await accountsApi.vendorDocumentsCreate({ verification: id, files: [file] });
          } catch (e) {
            setNote(`Submitted, but the document did not upload: ${apiError(e, 'upload failed')}`);
          }
        }
      }
    } catch (err) {
      const msg = apiError(err, 'Could not submit. Try again.');
      setError(msg);
      if (/pending|locked|already|approved|verified/i.test(msg)) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <div className="border-b border-slate-100 px-4 py-3.5 last:border-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</p>
            <p className="mt-1 text-[11px] text-slate-500">Submitted details can only be changed by ShopSafeNG staff.</p>
          </div>
          <StatusBadge state={state} />
        </div>
        {note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-b border-slate-100 px-4 py-4 last:border-0">
      {rejected && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          Rejected{info?.reason ? `: ${info.reason}` : '.'} Correct it and submit again.
        </p>
      )}
      <Field label={label} value={value} onChange={setValue} textarea={textarea} rows={2} inputMode={inputMode} />
      {withDocument && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3 py-2.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
          >
            <FileText size={13} /> {file ? 'Replace document' : 'Upload CAC certificate'}
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{file ? file.name : 'PDF, PNG or JPG, up to 10 MB'}</span>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">You can submit this once. After that only staff can change it.</p>
        <button
          onClick={submit}
          disabled={busy}
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Submit
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { vendor, loading, error, reload } = useVendorProfile();

  const signOut = () => {
    authService.logout().finally(() => {
      window.location.href = '/auth/signin';
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-ink">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Your business details and account security.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : error || !vendor ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error || 'Could not load your business profile.'}
          <button onClick={reload} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-200">Retry</button>
        </div>
      ) : (
        <>
          {/* Logo */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <SectionTitle icon={ImagePlus} title="Logo" note="Shown on your shop, products and chats. Your cover is generated from your business name." />
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink text-xl font-black text-white">
                {vendor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.logo} alt="Business logo" className="h-full w-full object-cover" />
                ) : (
                  (vendor.name || 'S').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{vendor.logo ? 'Logo uploaded' : 'No logo yet'}</p>
                <p className="mt-0.5 text-xs text-slate-600">Changing the logo after signup needs a backend endpoint that does not exist yet.</p>
              </div>
              <button disabled className="shrink-0 cursor-not-allowed rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-400">
                Upload
              </button>
            </div>
          </section>

          {/* Business identity (locked) */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <SectionTitle icon={Store} title="Business identity" note="Set at signup. Only ShopSafeNG staff can change these." />
            <LockedRow label="Business name" value={vendor.name} hint="Contact support to change it." />
            <LockedRow label="Phone number" value={vendor.phone} hint="Contact support to change it." />
          </section>

          {/* Verifiable details */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <SectionTitle icon={ShieldCheck} title="Business verification" note="Each item is reviewed separately. Once sent, it is locked." />
            <VerifyRow kind="cac" label="CAC registration number" initial={vendor.cac} verified={vendor.cacVerified} info={vendor.verification.cac} withDocument />
            <VerifyRow kind="tin" label="Tax ID (TIN)" initial={vendor.tin} verified={vendor.tinVerified} info={vendor.verification.tin} />
            <VerifyRow kind="address" label="Business address" initial={vendor.address} verified={vendor.addressVerified} info={vendor.verification.address} textarea />
          </section>
        </>
      )}

      {/* Security */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <SectionTitle icon={Phone} title="Security" />
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Password</p>
            <p className="mt-0.5 text-xs text-slate-600">Change the password you sign in with</p>
          </div>
          <button onClick={() => setPasswordOpen(true)} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-slate-50">
            Change
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <button onClick={signOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50">
          <LogOut size={17} /> Sign out
        </button>
      </section>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
