'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { authService, ordersService } from '@/lib/api';
import type { Order } from '@/lib/api';
import { money } from '@/lib/order-steps';
import OrderProgress from '@/app/components/OrderProgress';
import OrderSteps from '@/app/components/OrderSteps';
import PaymentStep from './PaymentStep';

/**
 * delivery: buyer gives delivery details
 * waiting:  details sent, vendor has not sent the delivery fee yet (payment locked)
 * payment:  vendor fee is in, buyer reviews and pays
 */
type Step = 'delivery' | 'waiting' | 'payment' | 'done';

const stepFor = (status: Order['status']): Step | 'blocked' =>
  status === 'awaiting_shipping_details' ? 'delivery' : status === 'shipping_set' ? 'waiting' : status === 'awaiting_payment' ? 'payment' : 'blocked';

export default function CheckoutPage() {
  const params = useParams();
  const orderId = String(params?.orderId ?? '');
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('delivery');
  const locked = order ? stepFor(order.status) === 'blocked' : false;
  const [busy, setBusy] = useState(false);

  const [shippingType, setShippingType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!orderId) return;
    authService.ensureUser().then((u) => {
      if (!u) {
        router.push(`/auth/signin?redirect=${encodeURIComponent(`/checkout/${orderId}`)}`);
        return;
      }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError('');
        const data = await ordersService.getOrder(orderId);
        setOrder(data);
        if (!silent) {
          setAddress(data.shipping_address && data.shipping_address !== 'Pickup' ? data.shipping_address : '');
          if (data.shipping_type) setShippingType(data.shipping_type);
        }
        const next = stepFor(data.status);
        // The server decides the step; the buyer can never sit on a step the order has not reached.
        if (next !== 'blocked') setStep((cur) => (cur === 'done' ? cur : next));
      } catch {
        if (!silent) setError('We could not load this order.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId]
  );

  // While waiting for the vendor's delivery fee, check again every few seconds.
  useEffect(() => {
    if (step !== 'waiting') return;
    const t = setInterval(() => void load(true), 6000);
    return () => clearInterval(t);
  }, [step, load]);

  const totals = useMemo(() => {
    const total = Number(order?.grand_total) || 0;
    const deliveryFee = Number(order?.shipping_fee) || 0;
    return { total, deliveryFee, subtotal: Math.max(0, total - deliveryFee) };
  }, [order]);

  const items = order?.items ?? [];

  const handleContinueToPayment = async () => {
    if (shippingType === 'delivery' && (!address.trim() || !city.trim())) {
      setError('Please add your delivery address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const shippingAddress =
        shippingType === 'pickup' ? 'Pickup' : [address.trim(), city.trim()].filter(Boolean).join(', ');
      await ordersService.setShipping(orderId, { shipping_type: shippingType, shipping_address: shippingAddress });
      await load(true); // moves to 'waiting' (vendor fee pending) or 'payment' if the fee is already in
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      setError(err.response?.data?.error || 'Could not save your delivery details. Please try again.');
      if (err.response?.status === 409) await load(true);
    } finally {
      setBusy(false);
    }
  };

  const handlePaid = async () => {
    try {
      await ordersService.paymentDecision(orderId, { action: 'pay' });
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      setError(err.response?.data?.error || 'Payment could not be completed. Please try again.');
      await load(true);
      return;
    }
    setStep('done');
    await load(true);
    window.dispatchEvent(new Event('shopam:cart-updated'));
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas">
        <Loader2 className="animate-spin text-[#FA3728]" size={32} />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/chats" className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white">
          Back to orders
        </Link>
      </div>
    );
  }

  /* ── Order is not on a checkout step (already paid, cancelled, waiting on vendor review, ...) ── */
  if (order && locked && step !== 'done') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <p className="max-w-sm text-sm font-semibold text-ink">
          {order.workflow?.blocked_reason || 'Checkout is not available for this order right now.'}
        </p>
        <OrderSteps workflow={order.workflow} className="max-w-sm" />
        <Link href={`/chats/${orderId}`} className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white">
          Back to the order chat
        </Link>
      </div>
    );
  }

  /* ── Confirmation ── */
  if (step === 'done') {
    return (
      <div className="min-h-[100dvh] bg-canvas font-sans text-ink antialiased">
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 pb-24 pt-20 text-center sm:px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={44} strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 font-bricolage text-3xl font-black tracking-tight">Order confirmed</h1>
          <p className="mt-2 text-sm text-slate-500">
            Payment received. We&apos;ll keep you updated as your order progresses.
          </p>

          <div className="mt-8 w-full rounded-2xl border border-slate-200/80 bg-white p-5">
            <OrderProgress status={order!.status} />
          </div>

          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
            <Link
              href={`/chats/${orderId}`}
              className="flex-1 rounded-full bg-ink py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#FA3728]"
            >
              View order
            </Link>
            <Link
              href="/explore"
              className="flex-1 rounded-full border border-slate-200 bg-white py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas font-sans text-ink antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => router.push(`/chats/${orderId}`)}
            aria-label="Back"
            className="flex h-9 w-9 -ml-1 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-ink sm:text-lg">Checkout</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {/* Steps */}
        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold">
          {(['delivery', 'payment'] as const).map((s, i) => {
            const active = s === 'delivery' ? step === 'delivery' || step === 'waiting' : step === 'payment';
            const done = s === 'delivery' && (step === 'waiting' || step === 'payment');
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-slate-300 sm:w-10" />}
                <span className={`flex items-center gap-1.5 ${active || done ? 'text-ink' : 'text-slate-400'}`}>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? 'bg-emerald-500 text-white' : active ? 'bg-ink text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  {s === 'delivery' ? 'Delivery' : 'Payment'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main column */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
            {error && (
              <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
            )}

            {step === 'delivery' && (
              <div>
                <h2 className="text-lg font-bold text-ink">Delivery details</h2>
                <p className="mt-1 text-xs text-slate-500">Where should this order go?</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {([
                    { id: 'delivery', label: 'Delivery', icon: Truck, hint: 'To your address' },
                    { id: 'pickup', label: 'Pickup', icon: Store, hint: 'From the vendor' },
                  ] as const).map(({ id, label, icon: Icon, hint }) => {
                    const active = shippingType === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setShippingType(id)}
                        className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          active ? 'border-ink bg-slate-900/[0.03]' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-ink text-white' : 'bg-slate-100 text-ink'}`}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink">{label}</span>
                          <span className="block truncate text-[11px] text-slate-500">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {shippingType === 'delivery' ? (
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Street address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        placeholder="House number, street, area"
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ink"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">City / State</label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Port Harcourt, Rivers"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ink"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone (optional)</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          inputMode="tel"
                          placeholder="080…"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    The vendor will share the pickup address after confirming your order.
                  </p>
                )}

                <button
                  onClick={handleContinueToPayment}
                  disabled={busy}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-sm font-bold text-white transition-colors hover:bg-[#FA3728] disabled:opacity-60"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : 'Continue to payment'}
                </button>
              </div>
            )}

            {step === 'waiting' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="animate-spin text-[#FA3728]" size={28} />
                <h2 className="text-lg font-bold text-ink">Waiting for the vendor&apos;s delivery fee</h2>
                <p className="max-w-sm text-xs text-slate-500">
                  Your delivery details are saved. You can pay once the vendor sends the delivery fee. This page updates by itself.
                </p>
                <button
                  disabled
                  className="mt-2 w-full max-w-xs cursor-not-allowed rounded-full bg-slate-200 py-3 text-sm font-bold text-slate-500"
                >
                  Review &amp; Pay
                </button>
              </div>
            )}

            {step === 'payment' && (
              <PaymentStep orderId={orderId} amount={totals.total} onPaid={handlePaid} />
            )}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <h2 className="mb-4 text-sm font-bold text-ink">Order summary</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.product_details.images?.[0]?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.product_details.images[0].image_url}
                          alt={item.product_details.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ShoppingBag size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {item.product_details.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {money(Number(item.product_details.price) || 0)} · qty {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-bold text-ink">
                      {money((Number(item.product_details.price) || 0) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-700">{money(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery fee</span>
                  <span className="font-medium text-slate-700">
                    {totals.deliveryFee ? money(totals.deliveryFee) : 'TBC'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold text-ink">
                  <span>Total</span>
                  <span>{money(totals.total)}</span>
                </div>
              </div>

              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                You were only charged after the vendor confirmed your order.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
