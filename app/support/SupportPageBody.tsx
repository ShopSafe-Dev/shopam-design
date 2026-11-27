'use client';

import Link from 'next/link';
import { Mail, MessageCircle, Scale } from 'lucide-react';
import SupportCenter from '@/app/components/support/SupportCenter';
import { useUser } from '@/lib/auth/useUser';

const LINKS = [
  { icon: MessageCircle, title: 'Ask the seller', copy: 'Questions about an order are fastest in the order chat.', href: '/chats' },
  { icon: Scale, title: 'Problem with a delivered order?', copy: 'Open the order and raise a dispute. Your money stays protected.', href: '/disputes' },
  { icon: Mail, title: 'Email us', copy: 'support@shopsafe.ng', href: 'mailto:support@shopsafe.ng' },
];

export default function SupportPageBody() {
  const { user } = useUser();
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">How can we help?</h1>
        <p className="mt-1 text-sm text-slate-600">Send us a request and follow the reply here.</p>
      </div>

      {user ? (
        <SupportCenter hrefBase="/support" />
      ) : (
        <Link href="/auth/signin?redirect=%2Fsupport" className="flex w-full items-center justify-center rounded-2xl bg-ink py-4 text-sm font-bold text-white hover:bg-[#FA3728]">
          Sign in to contact support
        </Link>
      )}

      <div className="space-y-3">
        {LINKS.map(({ icon: Icon, title, copy, href }) => (
          <Link key={title} href={href} className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-slate-300">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FA3728]/10 text-[#FA3728]"><Icon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{title}</span>
              <span className="mt-0.5 block text-xs text-slate-600">{copy}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
