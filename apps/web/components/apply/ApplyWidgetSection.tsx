'use client';

/**
 * ApplyWidgetSection.tsx — Wave 246
 *
 * Client wrapper that renders the ApplyWithVitalCV button in the holder dashboard.
 * Accepts an npi prop; the parent server component can pass it via Clerk claims or
 * a lightweight profile fetch. Falls back gracefully if NPI is not yet set.
 */

import Link from 'next/link';
import { ApplyWithVitalCV } from './ApplyWithVitalCV';

interface Props {
  npi?: string | null;
}

export function ApplyWidgetSection({ npi }: Props) {
  if (!npi) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-500 mb-1">Apply with VitalCV</p>
        <p className="text-xs text-zinc-600 mb-3">
          Complete onboarding to activate your clinician profile and generate a shareable credential bundle.
        </p>
        <Link href="/onboarding" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
          Finish onboarding →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/4 px-5 py-4 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Share Your Credentials
      </p>
      <p className="text-xs text-zinc-400">
        Generate the current passport share flow for employer review from the live wedge.
      </p>
      <div className="pt-1">
        <ApplyWithVitalCV npi={npi} label="Generate Credential Bundle" />
      </div>
    </div>
  );
}

export default ApplyWidgetSection;
