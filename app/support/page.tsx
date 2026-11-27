import type { Metadata } from 'next';
import AppBar from '@/app/components/ui/AppBar';
import BottomNav from '@/app/components/BottomNav';
import SupportPageBody from './SupportPageBody';

export const metadata: Metadata = {
  title: 'Help & Support',
  description: 'Get help with your ShopSafeNG account, orders and payments.',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-canvas pb-28 md:pb-16">
      <AppBar title="Help & Support" />
      <SupportPageBody />
      <BottomNav />
    </div>
  );
}
