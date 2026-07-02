import * as React from 'react';
import type { Metadata } from 'next';
import { PROVENANCE_META, type ProfileProvenance } from '@/lib/profile/provenance';
import ProfileSurface from './ProfileSurface';

export const metadata: Metadata = {
  title: 'Professional Profile · VitalCV',
  description:
    'Your live professional profile. User-entered information is not verified until source-backed evidence is attached.',
};

const LEGEND_ORDER: ReadonlyArray<ProfileProvenance> = [
  'VERIFIED',
  'USER_ENTERED',
  'INFERRED',
  'UNKNOWN',
  'CONFLICT',
];

/**
 * Server shell: renders the live client surface plus the provenance legend.
 * Truth rule pinned by tests: user-entered information is not verified until
 * source-backed evidence is attached, and every field carries a provenance
 * badge from the shared PROVENANCE_META vocabulary.
 */
export default function ClinicianProfilePage() {
  return (
    <div className="bg-zinc-950">
      <ProfileSurface />
      <aside
        aria-labelledby="provenance-legend-heading"
        className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 id="provenance-legend-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            How to read provenance badges
          </h2>
          <dl className="mt-3 space-y-2">
            {LEGEND_ORDER.map((key) => {
              const meta = PROVENANCE_META[key];
              return (
                <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </dt>
                  <dd className="text-xs leading-relaxed text-zinc-500">{meta.description}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </aside>
    </div>
  );
}
