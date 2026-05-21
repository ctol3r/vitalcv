import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The /holder -> /verify continuity bridge. Shown to a clinician who
 * has a readiness state but has not yet shared continuity outward.
 * Explains:
 *   - what /verify will let a receiving institution do
 *   - what the clinician brings to a receiving institution
 *   - what the receiving institution still owns
 *   - that the /verify surface is read-only (no credential decision
 *     is issued from it)
 *
 * Carries a single primary Link target.
 */
export interface VerificationPreparationProps {
  href: string;
  className?: string;
  /** Optional clinician display name; if absent the copy is generic. */
  clinicianDisplayName?: string;
}

const WHAT_VERIFY_DOES: readonly string[] = [
  'Inspects a VitalCV-signed receipt and shows the lane state.',
  'Displays the operator note attached to each lane.',
  'Confirms the receipt signature against the published JWKS.',
];

const WHAT_VERIFY_DOES_NOT_DO: readonly string[] = [
  'Issue or revoke a credential.',
  'Substitute the receiving institution\'s own primary-source verification.',
  'Move the application forward in the receiving institution\'s system.',
];

const WHAT_CLINICIAN_BRINGS: readonly string[] = [
  'A portable replay envelope per lane (federal-source resolution).',
  'An operator note that travels with each lane.',
  'A reference identifier the receiving institution can verify.',
];

export function VerificationPreparation({
  href,
  className,
  clinicianDisplayName,
}: VerificationPreparationProps) {
  return (
    <section
      data-slot="verification-preparation"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Continuity bridge · readiness to verifier
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          {clinicianDisplayName
            ? `${clinicianDisplayName}: prepare to share continuity with a receiving institution.`
            : 'Prepare to share continuity with a receiving institution.'}
        </h3>
      </header>

      <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
        <section
          data-slot="verification-preparation-what-clinician-brings"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What you bring
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
            {WHAT_CLINICIAN_BRINGS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section
          data-slot="verification-preparation-what-verify-does"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What /verify lets a reviewer do
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
            {WHAT_VERIFY_DOES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section
          data-slot="verification-preparation-what-verify-does-not-do"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What /verify does NOT do
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
            {WHAT_VERIFY_DOES_NOT_DO.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <Link
          href={href}
          data-slot="verification-preparation-link"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Open verifier surface
          <span aria-hidden className="font-mono">
            →
          </span>
        </Link>
        <p className="mt-2 max-w-[62ch] text-[11px] text-slate-500">
          The /verify surface is read-only. No credential decision is
          issued from it. Final review remains institution-owned.
        </p>
      </div>
    </section>
  );
}
