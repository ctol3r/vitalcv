import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Quiet disclosure stating that a surface simulates an operation but
 * does NOT actually perform the operation in the institution's
 * systems. Always rendered at the same position (above the simulated
 * control) so readers learn to look for it. The copy is binding:
 *   - what is simulated (the demo behavior)
 *   - what would happen in production (deferred work)
 *   - what the institution still owns
 *
 * Used by /verify (the JWT inspect surface), the employer review
 * acknowledgment, and the pilot submission confirmation.
 */
export interface BoundedSimulationDisclosureProps {
  /** Short label naming the simulated operation, e.g. "JWT verification". */
  simulationLabel: string;
  /** What this surface does (the bounded behavior). */
  whatIsSimulated: string;
  /** What a production-grade implementation would do (deferred). */
  whatWouldHappenInProduction: string;
  /** What stays institution-owned regardless. */
  whatRemainsInstitutionOwned: string;
  className?: string;
}

export function BoundedSimulationDisclosure({
  simulationLabel,
  whatIsSimulated,
  whatWouldHappenInProduction,
  whatRemainsInstitutionOwned,
  className,
}: BoundedSimulationDisclosureProps) {
  return (
    <section
      data-slot="bounded-simulation-disclosure"
      data-simulation-label={simulationLabel}
      className={cn(
        'overflow-hidden rounded-xl border border-amber-700 bg-amber-50',
        className,
      )}
    >
      <header className="border-b border-amber-200 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
          Bounded simulation · {simulationLabel}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3">
        <section
          data-slot="bounded-simulation-disclosure-what-is-simulated"
          className="rounded border border-amber-200 bg-white px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
            What this surface does
          </div>
          <p className="mt-1 text-xs text-slate-700">{whatIsSimulated}</p>
        </section>
        <section
          data-slot="bounded-simulation-disclosure-what-would-happen"
          className="rounded border border-amber-200 bg-white px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
            What production would do
          </div>
          <p className="mt-1 text-xs text-slate-700">
            {whatWouldHappenInProduction}
          </p>
        </section>
        <section
          data-slot="bounded-simulation-disclosure-what-stays"
          className="rounded border border-amber-200 bg-white px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-800">
            What stays institution-owned
          </div>
          <p className="mt-1 text-xs text-slate-700">
            {whatRemainsInstitutionOwned}
          </p>
        </section>
      </div>
    </section>
  );
}
