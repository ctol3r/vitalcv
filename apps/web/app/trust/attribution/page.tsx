/**
 * /trust/attribution — Attribution Hierarchy doctrine surface.
 *
 * Public, SSR-static, no auth. Intentionally has NO data dependencies
 * (does not call getTrustRegisterSnapshot or any receipt-issuer code)
 * so it stays available even when the issuer keypair is unset.
 *
 * Doctrine: explains who owns what across the four attribution layers
 * (source, system, institution, human override) plus the pilot-safety
 * line — what VitalCV does NOT guarantee. Vocabulary is evidence-bounded;
 * no "verified" / "cleared" / "approved" language.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Attribution Hierarchy — VitalCV',
  description:
    'How VitalCV attributes credential evidence across primary sources, the VitalCV system, the receiving institution review, and human override. Evidence-bounded; pilot-safe.',
};

interface AttributionRow {
  layer: string;
  owner: string;
  action: string;
  vocabulary: string;
}

const ATTRIBUTION_LAYERS: ReadonlyArray<AttributionRow> = [
  {
    layer: 'Source authority',
    owner: 'The primary-source registry (e.g. CMS NPPES, OIG/LEIE, PECOS, state medical board).',
    action: 'Returns the underlying record. VitalCV reads what the source returns; VitalCV does not author source data.',
    vocabulary: 'SOURCE-CONFIRMED · STALE · UNAVAILABLE · ACCESS REQUIRED',
  },
  {
    layer: 'System action',
    owner: 'The VitalCV runtime.',
    action: 'Reads the source within its freshness budget, records what was checked, attaches an operator note, and signs the resulting envelope. The system does NOT confirm fitness, employability, or institutional acceptance.',
    vocabulary: 'CHECKED · PENDING · REVIEW REQUIRED',
  },
  {
    layer: 'Institution review',
    owner: 'The receiving institution (CVO, MSO, hospital operations).',
    action: 'Reviews the evidence packet on its own credential and cadence. Disposition (accept / request more / not eligible) is institution-owned. VitalCV surfaces the affordance; the institution makes the decision.',
    vocabulary: 'PENDING REVIEW · IN REVIEW · INSTITUTION-CONFIRMED · NOT ELIGIBLE (INSTITUTION-OWNED)',
  },
  {
    layer: 'Human override',
    owner: 'A named operator at the receiving institution.',
    action: 'A reviewer may override a system-level state when the institution holds evidence the substrate cannot see (e.g. a recent state-board update not yet in the public registry). The override is recorded; the substrate state remains visible.',
    vocabulary: 'OVERRIDDEN BY REVIEWER · ORIGINAL STATE PRESERVED',
  },
];

interface ConstraintRow {
  category: string;
  doesNotGuarantee: string;
}

const NOT_GUARANTEED: ReadonlyArray<ConstraintRow> = [
  {
    category: 'Decision authority',
    doesNotGuarantee:
      'VitalCV does not approve, clear, or accept any clinician. Final eligibility for employment, privileging, or deployment is institution-owned.',
  },
  {
    category: 'Continuous monitoring',
    doesNotGuarantee:
      'VitalCV does not continuously monitor sources. Lanes are re-checked on request against the institution\'s own freshness budget.',
  },
  {
    category: 'Cryptographic certainty',
    doesNotGuarantee:
      'Receipt signatures confirm the signer held the private key at signing time. They do not prove tamper-resistance of upstream sources, immutability of registry data, or independent verification.',
  },
  {
    category: 'Source completeness',
    doesNotGuarantee:
      'A SOURCE-CONFIRMED lane attests only to what the upstream registry returned within the freshness budget. Sources can be stale, partial, or scoped to public records only.',
  },
  {
    category: 'Regulatory substitution',
    doesNotGuarantee:
      'VitalCV does not substitute for state medical board verification, credentialing committee review, or privileging decisions. Those remain on the institution\'s own cadence.',
  },
];

export default function AttributionPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-6 text-slate-100">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Trust surface · attribution hierarchy
        </div>
        <h1 className="mt-1 text-2xl font-semibold">
          Who owns what at every step.
        </h1>
        <p className="mt-3 max-w-[68ch] text-sm text-slate-200">
          VitalCV is an evidence layer. This page names the four
          attribution layers — source, system, institution review, and
          human override — and the boundary of what VitalCV does not
          guarantee. The vocabulary on every page derives from this
          attribution model.
        </p>
      </header>

      <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 sm:px-6">
        <section
          data-slot="attribution-hierarchy"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-white"
        >
          <header className="border-b border-slate-900 bg-slate-50 px-5 py-3">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
              Four attribution layers
            </h2>
            <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
              Read top-to-bottom: each layer adds context, never replaces
              the layer above it. The receiving institution remains the
              decision authority on every clinician.
            </p>
          </header>
          <ol className="divide-y divide-slate-200">
            {ATTRIBUTION_LAYERS.map((row, idx) => (
              <li
                key={row.layer}
                data-slot="attribution-layer"
                data-layer-index={idx + 1}
                className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-12"
              >
                <div className="sm:col-span-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Layer {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {row.layer}
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Owner
                  </div>
                  <div className="mt-1 text-xs text-slate-700">{row.owner}</div>
                </div>
                <div className="sm:col-span-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Action
                  </div>
                  <div className="mt-1 text-xs text-slate-700">{row.action}</div>
                </div>
                <div className="sm:col-span-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Vocabulary
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-700">
                    {row.vocabulary}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          data-slot="attribution-not-guaranteed"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-50"
        >
          <header className="border-b border-slate-900 bg-white px-5 py-3">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
              What VitalCV does not guarantee
            </h2>
            <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
              Pilot-safe language. Every claim on every VitalCV page is
              bounded by the rows below. Anything that contradicts these
              constraints is a regression.
            </p>
          </header>
          <ul className="divide-y divide-slate-200">
            {NOT_GUARANTEED.map((row) => (
              <li
                key={row.category}
                data-slot="not-guaranteed-row"
                className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Category
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {row.category}
                  </div>
                </div>
                <div className="sm:col-span-9">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    What VitalCV does not guarantee
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {row.doesNotGuarantee}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          data-slot="attribution-vocabulary"
          className="overflow-hidden rounded-2xl border border-slate-900 bg-white"
        >
          <header className="border-b border-slate-900 bg-slate-50 px-5 py-3">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
              Status vocabulary (canonical)
            </h2>
            <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
              These labels carry exact operational meaning. Other labels
              (verified, cleared, approved) are not used.
            </p>
          </header>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">CHECKED</dt>
              <dd className="text-slate-700">System read the source and recorded what it returned.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">SOURCE-CONFIRMED</dt>
              <dd className="text-slate-700">Source returned an affirmative match within freshness budget.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">PENDING</dt>
              <dd className="text-slate-700">Read is in flight or queued.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">ACCESS REQUIRED</dt>
              <dd className="text-slate-700">Source requires institutional credentials VitalCV does not hold.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">STALE</dt>
              <dd className="text-slate-700">Last read is past the freshness budget; re-fetch required.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">UNAVAILABLE</dt>
              <dd className="text-slate-700">Source did not respond within the freshness budget.</dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-wider text-slate-500">REVIEW REQUIRED</dt>
              <dd className="text-slate-700">The receiving institution still has work to do; the substrate has done what it can.</dd>
            </div>
          </dl>
        </section>

        <footer className="border-t border-dashed border-slate-300 pt-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Pilot surface · evidence-bounded · institution review preserved
        </footer>
      </div>
    </main>
  );
}
