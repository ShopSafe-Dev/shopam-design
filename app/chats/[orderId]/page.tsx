'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Info, Loader2, RefreshCcw } from 'lucide-react';
import { authService, ordersService, reviewsService } from '@/lib/api';
import type { Order } from '@/lib/api';
import { statusLabel } from '@/lib/order-steps';
import OrderProgress from '@/app/components/OrderProgress';
import OrderSteps from '@/app/components/OrderSteps';
import { buildMessagesUI } from './chat-logic';
import MessageBubble from './MessageBubble';
import ReviewModal from './ReviewModal';
import DisputeModal from './DisputeModal';
import { useThread } from '@/lib/chat/hooks';
import ConnectionPill from '@/app/components/chat/ConnectionPill';
import Composer from '@/app/components/chat/Composer';

export default function OrderChatPage() {
  const params = useParams();
  const orderId = String(params?.orderId ?? '');
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Customer-only page (vendor mode is redirected to /dashboard/messages), so the other side is always the seller.
  // vendor_user_id is the seller's USER id; `vendor` is the VendorProfile id and is not a valid chat recipient.
  const sellerUserId = order ? order.vendor_user_id ?? order.vendor : '';
  const thread = useThread({ order: orderId, other: sellerUserId || null });
  const messages = useMemo(
    // System messages repeat what the order cards already show, so only people's own text goes in the bubbles.
    () => (order ? buildMessagesUI(order, thread.messages.filter((m) => !m.is_system), thread.meId ?? undefined) : []),
    [order, thread.messages, thread.meId]
  );
  const failedCount = thread.messages.filter((m) => m.local === 'failed').length;

  useEffect(() => {
    if (!orderId) return;
    const user = authService.getCurrentUser();
    if (!user) {
      router.push(`/auth/signin?redirect=${encodeURIComponent(`/chats/${orderId}`)}`);
      return;
    }
    void refreshOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshOrder = async () => {
    try {
      setIsLoading(true);
      setError('');
      setOrder(await ordersService.getOrder(orderId));
    } catch {
      setError('We could not load this order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !sellerUserId) return;
    const content = newMessage;
    setNewMessage('');
    void thread.send(content);
  };

  // A 409 means the order moved on (or never reached this step): show why and resync instead of a generic error.
  const failWith = async (e: unknown, fallback: string) => {
    const err = e as { response?: { status?: number; data?: { error?: string } } };
    setError(err.response?.status === 409 ? err.response.data?.error || 'This order is not at that step.' : fallback);
    if (err.response?.status === 409) await refreshOrder();
  };

  const handleAcceptChanges = async () => {
    try {
      await ordersService.customerApprove(orderId, { action: 'accept' });
      await refreshOrder();
    } catch (e) {
      await failWith(e, 'Could not accept the changes. Please try again.');
    }
  };

  const handleRequestChanges = () => {
    setNewMessage('Could you please adjust: ');
    inputRef.current?.focus();
  };

  // Add delivery details and pay both live on the checkout page, which enforces the same step order.
  const handleReviewAndPay = () => {
    router.push(`/checkout/${orderId}`);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    try {
      await reviewsService.createReview({
        order: orderId,
        product: order?.items[0]?.product ?? null,
        rating,
        comment,
      });
    } catch {
      /* review is non-critical */
    } finally {
      setReviewOpen(false);
    }
  };

  const handleSubmitDispute = async (reason: string, email: string, details: string) => {
    try {
      await ordersService.raiseDispute(orderId, {
        email,
        reason: details ? `${reason} — ${details}` : reason,
      });
      await refreshOrder();
    } catch (e) {
      await failWith(e, 'Could not submit the dispute. Please try again.');
    } finally {
      setDisputeOpen(false);
    }
  };

  const vendorName = order?.vendor_name || 'Vendor';
  const showProgress = useMemo(
    () => Boolean(order) && !['pending_vendor_review', 'cancelled'].includes(order!.status),
    [order]
  );

  if (isLoading && !order) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-canvas">
        <Loader2 className="animate-spin text-[#FA3728]" size={32} />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/chats" className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink antialiased">
      {/* Header */}
      <header className="z-20 flex-shrink-0 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4 sm:h-18 sm:px-6">
          <button
            onClick={() => router.push('/chats')}
            aria-label="Back"
            className="flex h-9 w-9 -ml-1 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
              {vendorName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{vendorName}</p>
              <p className="truncate text-[11px] text-slate-400">
                {order ? statusLabel(order.status) : 'Order'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshOrder()}
            aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
          >
            <RefreshCcw size={17} className={isLoading ? 'animate-spin text-[#FA3728]' : ''} />
          </button>
        </div>
      </header>

      <ConnectionPill link={thread.link} />

      {/* Tracking */}
      {showProgress && order && (
        <div className="flex-shrink-0 border-b border-slate-200/70 bg-white/70">
          <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
            <OrderProgress status={order.status} />
          </div>
        </div>
      )}

      {order?.workflow && (
        <div className="flex-shrink-0 border-b border-slate-200/70 bg-white/70">
          <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
            <OrderSteps workflow={order.workflow} />
          </div>
        </div>
      )}

      {failedCount > 0 && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2 text-[12px] text-red-600 sm:px-6">
            {failedCount === 1 ? '1 message was not sent.' : `${failedCount} messages were not sent.`}
            <button
              onClick={() => thread.messages.filter((m) => m.local === 'failed').forEach((m) => void thread.retry(m.id))}
              className="font-bold underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {error && order && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50">
          <div className="mx-auto max-w-2xl px-4 py-2 text-[12px] text-red-600 sm:px-6">{error}</div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 py-5 sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {order?.status === 'pending_vendor_review' && (
            <div className="mx-auto flex max-w-md items-start gap-2 rounded-2xl bg-white px-4 py-3 text-[12px] leading-relaxed text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
              <Info size={15} className="mt-0.5 shrink-0 text-[#FA3728]" />
              The seller will confirm availability and delivery cost before you pay.
            </div>
          )}

          {messages.map((message, i) => (
            <MessageBubble
              key={`${message.id}-${i}`}
              message={message}
              index={i}
              isVendor={false}
              vendorName={vendorName}
              onAcceptChanges={handleAcceptChanges}
              onRequestChanges={handleRequestChanges}
              onReviewAndPay={handleReviewAndPay}
              confirmationCode={order?.confirmation_code}
              onLeaveReview={() => setReviewOpen(true)}
              onRaiseDispute={() => setDisputeOpen(true)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Composer */}
      <Composer value={newMessage} onChange={setNewMessage} onSend={handleSendMessage} accent="ink" inputRef={inputRef} />

      <AnimatePresence>
        <ReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSubmit={handleSubmitReview}
        />
        <DisputeModal
          open={disputeOpen}
          defaultEmail={authService.getCurrentUser()?.email}
          onClose={() => setDisputeOpen(false)}
          onSubmit={handleSubmitDispute}
        />
      </AnimatePresence>
    </div>
  );
}
