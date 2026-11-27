'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BadgeCheck, Banknote, Clock, FileText, ImagePlus, Loader2, Lock, LogOut, Phone, ShieldCheck, Store } from 'lucide-react';
import { authService } from '@/lib/api';
import { accountsApi } from '@/lib/api/endpoints/accounts';
import type { Bank, BankDetails, BankLookup, VerificationInfo } from '@/lib/api';
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

  // Live updates: a rejection or revocation pushed by staff must reopen the section, and approved or
  // staff-edited values must replace what is shown.
  useEffect(() => {
    if (server === 'rejected') setSubmitted(false);
  }, [server]);
  useEffect(() => {
    if (locked) setValue(initial);
  }, [initial, locked]);

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
      {rejected && info?.revoked && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Verification revoked{info.revoke_basis === 'vendor_request' ? ' at your request' : info.revoke_basis === 'disciplinary' ? ' (disciplinary action)' : info.revoke_basis === 'investigation' ? ' (investigation)' : ''}{info.reason ? `: ${info.reason}` : '.'}{' '}
          {info.reverify_by ? `Submit it again by ${new Date(info.reverify_by).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} or you will be locked out of sign-in.` : 'Submit it again.'}
        </p>
      )}
      {rejected && !info?.revoked && (
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

function LogoSection({ logo, name, onChanged }: { logo: string | null; name: string; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('Use a JPEG, PNG or WebP image.');
    if (f.size > 5 * 1024 * 1024) return setError('Logo must be 5 MB or smaller.');
    setBusy(true);
    try {
      await authService.uploadVendorLogo(f);
      onChanged();
    } catch (err) {
      setError(apiError(err, 'Could not upload the logo.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await authService.removeVendorLogo();
      onChanged();
    } catch (err) {
      setError(apiError(err, 'Could not remove the logo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <SectionTitle icon={ImagePlus} title="Logo" note="Shown on your shop, products and chats. JPEG, PNG or WebP, up to 5 MB." />
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink text-xl font-black text-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Business logo" className="h-full w-full object-cover" />
          ) : (
            (name || 'S').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{logo ? 'Logo uploaded' : 'No logo yet'}</p>
          {error ? (
            <p role="alert" className="mt-0.5 text-xs font-medium text-red-600">{error}</p>
          ) : (
            logo && !busy && (
              <button type="button" onClick={remove} className="mt-0.5 text-xs font-semibold text-slate-500 underline hover:text-red-600">Remove logo</button>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" />} {logo ? 'Change' : 'Upload'}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </section>
  );
}

/** Type-ahead bank picker. Searches on the server as you type (debounced), so the result is never a stale or partial list. */
function BankPicker({ value, onChange }: { value: Bank | null; onChange: (bank: Bank | null) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Bank[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const seq = useRef(0);

  // Debounced server search. Only the latest request may update the list.
  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    setSearching(true);
    setError('');
    const t = setTimeout(
      () => {
        authService
          .getBanks(query, 30)
          .then((r) => {
            if (my !== seq.current) return;
            setResults(r);
            setActive(0);
          })
          .catch((e) => {
            if (my === seq.current) setError(apiError(e, 'Could not search banks.'));
          })
          .finally(() => {
            if (my === seq.current) setSearching(false);
          });
      },
      query ? 250 : 0
    );
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const pick = (b: Bank) => {
    onChange(b);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="bank-picker" className="mb-1 block text-xs font-semibold text-slate-500">Bank</label>
      <div className="relative">
        <input
          id="bank-picker"
          role="combobox"
          aria-expanded={open}
          aria-controls="bank-picker-list"
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : value?.name ?? query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onKeyDown={onKey}
          placeholder="Type your bank name, e.g. Moniepoint"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-ink"
        />
        {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {open && (
        <ul
          id="bank-picker-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {error && <li className="px-3 py-2 text-sm text-red-600">{error}</li>}
          {!error && !searching && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">{query ? <>No bank matches &quot;{query}&quot;.</> : 'No banks available.'}</li>
          )}
          {results.map((b, i) => (
            <li
              key={b.code}
              role="option"
              aria-selected={b.code === value?.code}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(b);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-slate-100 text-ink' : 'text-slate-700'} ${b.code === value?.code ? 'font-bold' : ''}`}
            >
              {b.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BankSection({ bank, info, onChanged }: { bank: BankDetails | null; info?: VerificationInfo; onChanged: () => void }) {
  const [editing, setEditing] = useState(!bank);
  const [bankSel, setBankSel] = useState<Bank | null>(null);
  const [number, setNumber] = useState('');
  const [lookup, setLookup] = useState<BankLookup | null>(null);
  const [mine, setMine] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const code = bankSel?.code ?? '';
  const needPassword = !!bank && (bank.bank_identity_status === 'verified');
  const revoked = !!info?.revoked && !bank;

  const reset = () => {
    setLookup(null);
    setMine(false);
    setError('');
  };

  const find = async () => {
    reset();
    if (!code) return setError('Choose your bank.');
    if (!/^\d{10}$/.test(number)) return setError('Enter the 10-digit account number.');
    setBusy(true);
    try {
      setLookup(await authService.resolveBankAccount(number, code));
    } catch (e) {
      setError(apiError(e, 'Could not look up that account.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!lookup) return;
    setError('');
    setBusy(true);
    try {
      await authService.confirmBankAccount(lookup.account_number, lookup.bank_code, needPassword ? password : undefined);
      setEditing(false);
      setPassword('');
      reset();
      onChanged();
    } catch (e) {
      setError(apiError(e, 'Could not save the account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <SectionTitle icon={Banknote} title="Payout account" note="Where your earnings are sent. We look up the account name so you can confirm it is yours." />
      {revoked && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Your payout account verification was revoked{info?.reason ? `: ${info.reason}` : '.'}{' '}
          {info?.reverify_by ? `Verify an account by ${new Date(info.reverify_by).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}
        </p>
      )}
      {bank && !editing ? (
        <div className="flex items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{bank.account_name}</p>
            <p className="mt-0.5 text-xs text-slate-600">{bank.bank_name} • ••••{bank.account_number.slice(-4)}</p>
            <div className="mt-2"><StatusBadge state={bank.bank_identity_status === 'verified' ? 'verified' : 'pending'} /></div>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-ink hover:border-ink">Change</button>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4">
          <BankPicker value={bankSel} onChange={(b) => { setBankSel(b); reset(); }} />
          <Field label="Account number" value={number} onChange={(v) => { setNumber(v.replace(/\D/g, '').slice(0, 10)); reset(); }} inputMode="numeric" />
          {!lookup && (
            <button type="button" onClick={find} disabled={busy} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" />} Find account name
            </button>
          )}
          {lookup && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account name</p>
                <p className="text-base font-black text-ink">{lookup.account_name}</p>
                <p className="text-xs text-slate-600">{lookup.bank_name} • {lookup.account_number}</p>
              </div>
              {!lookup.name_matches_profile && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This name does not look like your name or business name. Only continue if the account is really yours.</p>
              )}
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="mt-0.5" />
                This is my account and the name is correct.
              </label>
              {needPassword && <Field label="Your password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />}
              <div className="flex gap-2">
                <button type="button" onClick={confirm} disabled={!mine || busy || (needPassword && !password)} className="flex items-center gap-2 rounded-full bg-[#FA3728] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
                  {busy && <Loader2 size={14} className="animate-spin" />} Confirm and save
                </button>
                <button type="button" onClick={reset} className="rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-ink">Not mine</button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
          {bank && (
            <button type="button" onClick={() => { setEditing(false); reset(); }} className="text-xs font-semibold text-slate-500 underline">Cancel</button>
          )}
        </div>
      )}
    </section>
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
          <LogoSection logo={vendor.logo} name={vendor.name} onChanged={reload} />

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

          <BankSection bank={vendor.bank} info={vendor.verification.bank} onChanged={reload} />
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
