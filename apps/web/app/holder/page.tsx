'use client';

import { WalletDashboard } from '@/components/clinician/WalletDashboard';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions'; // Wave 98
import ImpactPanel from '@/components/impact/ImpactPanel';

export default function HolderPage() {
  return (
    <>
      <WalletDashboard />

      {/* Wave 98: Verifiable Presentation — Download & Share */}
      <div className="px-6 py-4 flex justify-end max-w-5xl mx-auto">
        <CredentialPresentationActions holderNpi="1003000126" />
      </div>

      <ImpactPanel npi="1003000126" />
    </>
  );
}
