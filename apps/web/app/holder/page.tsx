'use client';

import { WalletDashboard } from '@/components/clinician/WalletDashboard';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions'; // Wave 98+103
import { CredentialWallet } from '@/components/wallet/CredentialWallet'; // Wave 104
import ImpactPanel from '@/components/impact/ImpactPanel';

export default function HolderPage() {
  return (
    <>
      <WalletDashboard />

      {/* Wave 104: Full Credential Wallet */}
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <CredentialWallet subject="1003000126" />
      </div>

      {/* Wave 98+103: Verifiable Presentation — Download, Share & Selective */}
      <div className="px-6 pb-4 flex justify-end max-w-5xl mx-auto">
        <CredentialPresentationActions holderNpi="1003000126" />
      </div>

      <ImpactPanel npi="1003000126" />
    </>
  );
}
