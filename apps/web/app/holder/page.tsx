'use client';

/**
 * Holder Page — Wave 130: State Machine refactor
 *
 * Wallet flow is now backed by useWalletMachine().
 * State: IDLE → LOADING → CREDENTIAL_LIST → DISCLOSURE_SELECTING → PRESENTING → PRESENTED
 * All UI reads state.current; no ad-hoc boolean flags.
 */

import { useEffect } from 'react';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CredentialPresentationActions } from '@/components/clinician/CredentialPresentationActions';
import ImpactPanel from '@/components/impact/ImpactPanel';
import { useWalletMachine } from '@/lib/state-machines';

const DEMO_NPI = '1003000126';

export default function HolderPage() {
  const wallet = useWalletMachine();

  // Boot the machine: transition IDLE → LOADING → CREDENTIAL_LIST on mount
  useEffect(() => {
    wallet.send({ type: 'LOAD' });
    // Passport component manages its own data fetching; we just track UI phase
    const timer = setTimeout(() => wallet.send({ type: 'LOAD_SUCCESS' }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSkeleton = wallet.is('IDLE') || wallet.isLoading;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Machine state badge (dev aid — collapses in production via opacity) */}
      <div className="px-6 pt-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 text-[10px] font-mono text-zinc-700 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          wallet:{wallet.state.current}
        </div>
      </div>

      {/* Wave 121: Passport-first wallet */}
      <div className="px-6 pb-8 max-w-3xl mx-auto">
        {showSkeleton ? (
          <div className="rounded-2xl bg-zinc-900/60 animate-pulse h-64" />
        ) : (
          <WalletPassport npi={DEMO_NPI} pollIntervalMs={30_000} />
        )}
      </div>

      {/* Wave 104: Detailed credential view — only visible once loaded */}
      {!showSkeleton && (
        <div className="px-6 py-4 max-w-5xl mx-auto">
          <details className="group">
            <summary className="text-[10px] text-zinc-600 uppercase tracking-wider cursor-pointer hover:text-zinc-400 transition-colors">
              Detailed Credential View
            </summary>
            <div className="mt-4">
              <CredentialWallet subject={DEMO_NPI} />
            </div>
          </details>
        </div>
      )}

      {/* Wave 98+103: Presentation actions — show once credential list is ready */}
      {(wallet.is('CREDENTIAL_LIST') || wallet.isSelectingClaims || wallet.isPresenting || wallet.is('PRESENTED')) && (
        <div className="px-6 pb-4 flex justify-end max-w-5xl mx-auto">
          <CredentialPresentationActions holderNpi={DEMO_NPI} />
        </div>
      )}

      <ImpactPanel npi={DEMO_NPI} />
    </div>
  );
}
