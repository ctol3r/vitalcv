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

export default function VerifierPage() {
  const verifier = useVerifierMachine();

  return (
    <>
      {/* Machine state badge */}
      <div className="px-6 pt-6 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 text-[10px] font-mono text-zinc-600 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          verifier:{verifier.state.current}
        </div>
      </div>

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
