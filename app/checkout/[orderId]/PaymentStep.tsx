'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Lock } from 'lucide-react';
import { ordersService } from '@/lib/api';
import { money } from '@/lib/order-steps';
import { payApi } from '@/lib/payments/api';
import { openMonnify } from '@/lib/payments/monnify';

type Phase = 'idle' | 'opening' | 'open' | 'confirming' | 'timeout';

const POLL_MS = 3000;
const POLL_MAX = 40; // about 2 minutes

/**
 * Pay in Monnify's modal. Our server never sees card details. When the customer finishes, we wait for the
 * signed webhook to move the order to "paid" (we poll the order) and only then call onPaid.
 */
export default function PaymentStep({ orderId, amount, onPaid }: { orderId: string; amount: number; onPaid: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const alive = useRef(true);
  const ready = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (watchdog.current) clearTimeout(watchdog.current);
    };
  }, []);

  const waitForWebhook = async () => {
    setPhase('confirming');
    for (let i = 0; i < POLL_MAX && alive.current; i++) {
      try {
        const o = await ordersService.getOrder(orderId);
        if (o.status !== 'awaiting_payment') {
          if (alive.current) onPaid();
          return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (alive.current) setPhase('timeout');
  };

  const start = async () => {
    setError('');
    setPhase('opening');
    ready.current = false;
    try {
      const prep = await payApi.prepare(orderId);
      // If Monnify's modal never reports ready (bad keys, blocked frame), stop the spinner and say so.
      watchdog.current = setTimeout(() => {
        if (!alive.current || ready.current) return;
        setPhase((p) => (p === 'opening' || p === 'open' ? 'idle' : p));
        setError('The payment window did not appear. Check that your Monnify keys are correct, or pay in a new tab.');
      }, 12000);
      await openMonnify(prep, {
        onReady: () => {
          ready.current = true;
          if (watchdog.current) clearTimeout(watchdog.current);
          setPhase((p) => (p === 'opening' ? 'open' : p));
        },
        onComplete: () => void waitForWebhook(),
        // Closing the modal before paying just returns to the button. A payment that completed anyway is
        // picked up by the order polling below or by reopening this page.
        onClose: () => setPhase((p) => (p === 'confirming' ? p : 'idle')),
      });
    } catch (e) {
      if (watchdog.current) clearTimeout(watchdog.current);
      const err = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
      setPhase('idle');
      if (err.response?.status === 409) setError(err.response.data?.error || 'This order is not ready for payment yet.');
      else if (err.response?.data?.error) setError(err.response.data.error);
      else setError(`${err.message || 'Could not open the payment window.'} Try again, or pay in a new tab.`);
    }
  };

  const newTab = async () => {
    setError('');
    try {
      const url = await payApi.hostedUrl(orderId);
      window.open(url, '_blank', 'noopener');
      void waitForWebhook();
    } catch {
      setError('Could not start the payment. Please try again.');
    }
  };

  if (phase === 'confirming') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="animate-spin text-[#FA3728]" size={30} />
        <h2 className="text-lg font-bold text-ink">Confirming your payment</h2>
        <p className="max-w-xs text-xs text-slate-500">This takes a few seconds. Please do not close this page.</p>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="text-slate-400" size={30} />
        <h2 className="text-lg font-bold text-ink">We have not received confirmation yet</h2>
        <p className="max-w-sm text-xs text-slate-500">
          If your bank debited you, the order updates by itself as soon as the payment is confirmed. Do not pay again.
        </p>
        <button onClick={() => void waitForWebhook()} className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-white">
          Check again
        </button>
      </div>
    );
  }

  const busy = phase === 'opening';
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-ink">Payment</h2>
      <p className="text-xs text-slate-500">Pay by card or bank transfer in a secure window. Your money is held in escrow until you receive the order.</p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

      <button
        onClick={() => void start()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FA3728] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#E31B23] disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={15} />}
        {busy ? 'Opening payment window' : phase === 'open' ? 'Reopen payment window' : `Pay ${money(amount)}`}
      </button>

      <button onClick={() => void newTab()} className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink">
        <ExternalLink size={12} /> Payment window not opening? Pay in a new tab
      </button>
    </div>
  );
}
