'use client';

/**
 * Holder Page — Wave 121: Clinician Wallet 2.0
 *
 * Portable authority passport view with live trust band,
 * credential cards, selective disclosure, and passkey stubs.
 */

import { useState } from 'react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import ImpactPanel from '@/components/impact/ImpactPanel';

export default function HolderPage() {
  const [npi] = useState('1003000126');

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Wave 121: Passport-first wallet */}
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <WalletPassport npi={npi} pollIntervalMs={30_000} />
      </div>

      {/* Wave 104: Legacy credential list (detailed view) */}
      <div className="px-6 py-4 max-w-5xl mx-auto">
        <details className="group">
          <summary className="text-[10px] text-zinc-600 uppercase tracking-wider cursor-pointer hover:text-zinc-400 transition-colors">
            Detailed Credential View
          </summary>
          <div className="mt-4">
            <CredentialWallet subject={npi} />
          </div>
        </details>
      </div>

      {/* Wave 98+103: Presentation actions */}
      <div className="px-6 pb-4 flex justify-end max-w-5xl mx-auto">
        <CredentialPresentationActions holderNpi={npi} />
      </div>

      <ImpactPanel npi={npi} />
    </div>
  );
}
