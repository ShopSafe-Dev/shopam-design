import { Bell, Heart, LifeBuoy, MessageCircle, Package, Scale, Share2, UserPlus, Wallet, BarChart3 } from 'lucide-react';
import type { Notification } from '@/lib/api';
import { notificationKind } from '@/lib/notifications/format';

const ICONS: Record<string, { Icon: typeof Bell; tone: string }> = {
  like: { Icon: Heart, tone: 'bg-rose-50 text-rose-600' },
  comment: { Icon: MessageCircle, tone: 'bg-blue-50 text-blue-600' },
  share: { Icon: Share2, tone: 'bg-violet-50 text-violet-600' },
  follow: { Icon: UserPlus, tone: 'bg-emerald-50 text-emerald-600' },
  order: { Icon: Package, tone: 'bg-slate-100 text-slate-700' },
  dispute: { Icon: Scale, tone: 'bg-amber-50 text-amber-700' },
  support: { Icon: LifeBuoy, tone: 'bg-sky-50 text-sky-700' },
  refund: { Icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
  payout: { Icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
  weekly_digest: { Icon: BarChart3, tone: 'bg-slate-100 text-slate-700' },
};

/** The person's picture when there is one (likes, follows...), otherwise an icon for the kind of notification. */
export default function NotificationIcon({ item }: { item: Notification }) {
  const kind = notificationKind(item);
  const { Icon, tone } = ICONS[kind] ?? { Icon: Bell, tone: 'bg-slate-100 text-slate-600' };
  return (
    <span className="relative mt-0.5 h-9 w-9 shrink-0">
      {item.actor_avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.actor_avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone}`}><Icon size={16} /></span>
      )}
      {item.actor_avatar && (
        <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${tone}`}><Icon size={9} /></span>
      )}
    </span>
  );
}
