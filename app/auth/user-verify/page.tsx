'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/lib/api';
import AuthShell from '../../components/auth/AuthShell';

function UserVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');
  const emailHint = searchParams.get('email');
  const fromLogin = searchParams.get('from') === 'login';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(fromLogin ? 60 : 0);
  const [verifiedNeedsSignIn, setVerifiedNeedsSignIn] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');

  const resend = async () => {
    if (resending) return;
    setError('');
    setNotice('');
    setResending(true);
    try {
      await authService.resendVerification(emailHint ?? undefined);
      setNotice('A new verification link is on its way. Check your inbox and spam folder.');
      setResendTimer(60);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setError('Too many requests. You can request up to 3 links per hour. Please try again later.');
      } else if (status === 401) {
        setError('Sign in with your email and password and we will send you a fresh link automatically.');
      } else {
        setError('Could not send the link. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!urlToken) return;
    setIsSubmitting(true);
    authService
      .verifyEmail(urlToken)
      .then(({ authenticated }) => {
        setSuccess(true);
        if (authenticated) {
          setTimeout(() => router.push('/explore'), 5000);
        } else {
          setVerifiedNeedsSignIn(true);
          setTimeout(() => router.push('/auth/signin?verified=1'), 5000);
        }
      })
      .catch((err: unknown) => {
        const message = (err as { message?: string })?.message;
        setError(message ?? 'Verification link is invalid or has expired.');
      })
      .finally(() => setIsSubmitting(false));
  }, [urlToken, router]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  if (urlToken && isSubmitting) {
    return (
      <AuthShell
        align="center"
        title="Verifying your email"
        subtitle="Just a moment while we confirm your account."
      >
        <div className="flex justify-center py-2">
          <Loader2 size={32} className="animate-spin text-[#FA3728]" />
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        align="center"
        title="Email verified"
        subtitle={
          verifiedNeedsSignIn
            ? 'Your email is confirmed. Redirecting you to sign in…'
            : 'Your account is active. Redirecting you to ShopAm…'
        }
      >
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-white">
            <CheckCircle2 size={32} />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        emailHint ? (
          <>
            We sent a verification link to{' '}
            <span className="font-semibold text-ink break-all">{emailHint}</span>. Click it to
            activate your account.
          </>
        ) : (
          'We sent a verification link to your email address. Click it to activate your account.'
        )
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {fromLogin && !notice && !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Your email isn&apos;t verified yet. We sent a new verification link when you tried to sign in.
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Didn&apos;t receive it? Check your spam folder or request a new link.
        </div>

        <div className="text-center">
          {resendTimer > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Loader2 size={11} className="animate-spin" />
              Resend available in {resendTimer}s
            </span>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FA3728] transition-colors hover:text-[#E31B23] hover:underline disabled:opacity-60"
            >
              {resending && <Loader2 size={13} className="animate-spin" />}
              Resend verification link
            </button>
          )}
        </div>

        <Link
          href="/auth/signin"
          className="flex items-center justify-center pt-1 text-sm text-slate-500 transition-colors hover:text-[#FA3728]"
        >
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function UserVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#F8F9FA]">
          <Loader2 size={32} className="animate-spin text-[#FA3728]" />
        </div>
      }
    >
      <UserVerifyForm />
    </Suspense>
  );
}
