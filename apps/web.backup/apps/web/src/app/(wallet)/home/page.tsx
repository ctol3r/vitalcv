/**
 * Wallet Home Page
 * Main entry point for the wallet home screen
 */

'use client';

import { WalletHomeView } from '@/components/wallet/WalletHomeView';
import { FloatingActionButton } from '@/components/wallet/FloatingActionButton';
import { PullToRefresh } from '@/components/wallet/PullToRefresh';

export default function WalletHomePage() {
  return (
    <PullToRefresh>
      <WalletHomeView />
      <FloatingActionButton />
    </PullToRefresh>
  );
}








