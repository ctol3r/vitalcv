'use client';

/**
 * Verifier Page — Wave 130: State Machine refactor
 *
 * Review flow backed by useVerifierMachine().
 * State: IDLE → REVIEWING → ACCEPTING → ACCEPTED | REJECTED
 */

import { useVerifierMachine } from '@/lib/state-machines';
import { VerifierPortal } from '@/components/employer/VerifierPortal';
import { AcceptancePanel } from '@/components/verifier/AcceptancePanel';

function DemoBanner() {
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-center">
      <p className="text-[11px] font-medium text-amber-400/80">
        Demo environment - data shown is not real credential verification
      </p>
    </div>
  );
}

export default function VerifierPage() {
  const verifier = useVerifierMachine();

  return (
    <>
      <DemoBanner />
      <VerifierPortal />

      {/* Wave 99: Acceptance panel — always visible; machine state controls internal behaviour */}
      <div className="px-6 py-10 max-w-2xl mx-auto">
        {verifier.isSettled ? (
          <div className="rounded-xl border border-white/5 bg-white/2 p-6 text-center space-y-3">
            <p className={`text-lg font-semibold ${verifier.is('ACCEPTED') ? 'text-emerald-400' : 'text-red-400'}`}>
              {verifier.is('ACCEPTED') ? '✓ Credential Accepted' : '✗ Credential Rejected'}
            </p>
            <button
              type="button"
              onClick={() => verifier.send({ type: 'RESET' })}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
            >
              Review another credential
            </button>
          </div>
        ) : (
          <AcceptancePanel />
        )}
      </div>
    </>
  );
}
