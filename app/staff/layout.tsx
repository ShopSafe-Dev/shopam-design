'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, FileText, Home, LogOut, MessageCircle, ShieldCheck, User, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authService } from '@/lib/api';
import { staffApi } from '@/lib/api/endpoints/staff';
import ShopSafeLogo from '@/app/components/ui/ShopSafeLogo';
import { httpStatus } from './ui';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/staff', label: 'Overview', icon: Home },
  { href: '/staff/verifications', label: 'Verifications', icon: ShieldCheck },
  { href: '/staff/tickets', label: 'Tickets', icon: MessageCircle },
  { href: '/staff/payouts', label: 'Payouts', icon: Wallet },
  { href: '/staff/reviews', label: 'Reviews', icon: FileText },
  { href: '/staff/mailer', label: 'Mailer', icon: Bell },
  { href: '/staff/staff', label: 'Staff', icon: User },
];

type Gate = 'checking' | 'ok' | 'denied' | 'error';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>('checking');
  const ran = useRef(false);

useEffect(() => {
  if (ran.current) return;
  ran.current = true;
  (async () => {
    try {
      const user = await authService.ensureUser();
      if (!user) {
        window.location.replace('/auth/signin?redirect=' + encodeURIComponent(pathname));
        return;
      }
      if (user.is_admin === false) {
        setGate('denied');
        return;
      }
      if (user.is_admin === true) {
        setGate('ok');
        return;
      }
      // is_admin missing from the profile: fall back to an admin-only call
      await staffApi.ticketsList();   // 403 for non-staff
      setGate('ok');
    } catch (err) {
      setGate(httpStatus(err) === 403 ? 'denied' : 'error');
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
  const signOut = () => {
    authService.logout().finally(() => {
      window.location.href = '/auth/signin';
    });
  };

  if (gate === 'checking') return null;

  if (gate !== 'ok') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <h1 className="text-lg font-bold text-ink">{gate === 'denied' ? 'Admin access only' : 'Could not reach the server'}</h1>
        <p className="max-w-sm text-sm text-slate-600">
          {gate === 'denied'
            ? 'Your account does not have staff permissions.'
            : 'The admin check failed. Refresh the page, or try again in a moment.'}
        </p>
        <Link href="/" className="text-sm font-semibold text-[#FA3728] hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const isActive = (href: string) => (href === '/staff' ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200/70 bg-white md:flex">
        <div className="px-5 pb-2 pt-6">
          <Link href="/staff" aria-label="Staff home">
            <ShopSafeLogo height={28} />
          </Link>
        </div>
        <p className="px-5 pb-3 pt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Staff</p>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive(href) ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
          <LogOut size={17} /> Sign out
        </button>
      </aside>

      {/* Mobile top tabs */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <ShopSafeLogo height={24} />
          <button onClick={signOut} aria-label="Sign out" className="text-red-600">
            <LogOut size={18} />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                isActive(href) ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8 md:pt-9">{children}</div>
      </main>
    </div>
  );
}
