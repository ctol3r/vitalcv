'use client';

import { WalletDashboard } from '@/components/clinician/WalletDashboard';
import ImpactPanel from '@/components/impact/ImpactPanel';

export default function HolderPage() {
  return (
    <>
      <WalletDashboard />
      <ImpactPanel npi="1003000126" />
    </>
  );
}
