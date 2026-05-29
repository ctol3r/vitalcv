import * as React from 'react';
import { TruthStateChip } from '@/design-system/components/TruthStateChip';
import type { TruthStateKind } from '@/design-system/components/TruthStateChip';

/**
 * The canonical disclaimer for the public source-attribution surface.
 * Lives here (rather than in `app/trust/attribution/page.tsx`) so it
 * can be imported by both the page itself and by tests — Next.js page
 * files cannot export arbitrary constants.
 */
export const TRUST_ATTRIBUTION_DISCLAIMER =
  'We publish the source of every field. We do not claim HIPAA, SOC 2, or NCQA certification.';

/**
 * TrustAttributionRegister — per-field receipt-document register.
 *
 * Each row names a Passport-visible field, the source(s) we read for
 * it, the typical retrieval-time context (when the read happens
 * relative to a request), the current state of that field, and the
 * institution-review boundary that applies to it.
 *
 * The register is **field-level**, not aggregate. It avoids any
 * top-of-page claim of "verified" / "credentialed" / "complete."
 * Every row says, in plain operator language, "here is what we read,
 * here is what state it is in, here is who decides."
 *
 * Truth-contract guarantees (enforced by
 * `apps/web/__tests__/trust-attribution-register.test.tsx`):
 *  - Every "Review boundary" cell either says "institution review" or
 *    "n/a" — never "verified", never "cleared", never "approved".
 *  - NPPES rows say `temporarily-unavailable` or `source-backed`
 *    depending on the typical state; OIG / PECOS / STATE_BOARD /
 *    FSMB / NURSYS rows never claim `source-backed`.
 *  - The opening disclaimer is the contracted phrase: "We publish the
 *    source of every field. We do not claim HIPAA, SOC 2, or NCQA
 *    certification."
 */

export interface AttributionRow {
  field: string;
  source: string;
  retrievalTime: string;
  state: TruthStateKind;
  reviewBoundary: 'institution review' | 'n/a';
}

export const TRUST_ATTRIBUTION_ROWS: ReadonlyArray<AttributionRow> = Object.freeze([
  {
    field: 'Display name',
    source: 'NPPES',
    retrievalTime: 'on Passport read; per request',
    state: 'temporarily-unavailable',
    reviewBoundary: 'institution review',
  },
  {
    field: 'NPI',
    source: 'operator-entered',
    retrievalTime: 'at /passport input',
    state: 'source-backed',
    reviewBoundary: 'n/a',
  },
  {
    field: 'Identity status',
    source: 'NPPES',
    retrievalTime: 'on Passport read; per request',
    state: 'temporarily-unavailable',
    reviewBoundary: 'institution review',
  },
  {
    field: 'Taxonomy / specialty',
    source: 'NPPES',
    retrievalTime: 'on Passport read; per request',
    state: 'temporarily-unavailable',
    reviewBoundary: 'institution review',
  },
  {
    field: 'OIG / LEIE exclusion result',
    source: 'OIG / LEIE',
    retrievalTime: 'not retrieved (connector not live)',
    state: 'connector-not-live',
    reviewBoundary: 'institution review',
  },
  {
    field: 'CMS PECOS enrollment',
    source: 'CMS PECOS',
    retrievalTime: 'not retrieved (connector not live)',
    state: 'connector-not-live',
    reviewBoundary: 'institution review',
  },
  {
    field: 'State medical-board license',
    source: 'state medical board',
    retrievalTime: 'gated by per-jurisdiction access',
    state: 'access-required',
    reviewBoundary: 'institution review',
  },
  {
    field: 'FSMB practitioner record',
    source: 'FSMB',
    retrievalTime: 'not retrieved (connector not live)',
    state: 'connector-not-live',
    reviewBoundary: 'institution review',
  },
  {
    field: 'Nursys license',
    source: 'Nursys',
    retrievalTime: 'not retrieved (connector not live)',
    state: 'connector-not-live',
    reviewBoundary: 'institution review',
  },
] as const);

export interface TrustAttributionRegisterProps {
  rows?: ReadonlyArray<AttributionRow>;
  className?: string;
}

/**
 * Render the receipt-document attribution register.
 */
export function TrustAttributionRegister({
  rows = TRUST_ATTRIBUTION_ROWS,
  className,
}: TrustAttributionRegisterProps) {
  return (
    <section
      data-trust-attribution-register=""
      aria-labelledby="trust-attribution-register-heading"
      className={className}
    >
      <h2
        id="trust-attribution-register-heading"
        className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
      >
        Per-field attribution
      </h2>
      <p className="mt-1 text-[10px] text-gray-500">
        Each row: field, source, when we read it, current state, who decides.
      </p>
      <div className="mt-3 overflow-hidden border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[9px] uppercase tracking-widest text-gray-600">
              <th className="px-4 py-1.5 text-left font-normal">Field</th>
              <th className="px-4 py-1.5 text-left font-normal">Source</th>
              <th className="px-4 py-1.5 text-left font-normal">Retrieval time</th>
              <th className="px-4 py-1.5 text-left font-normal">State</th>
              <th className="px-4 py-1.5 text-left font-normal">Review boundary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {rows.map((row) => (
              <tr
                key={row.field}
                data-trust-attribution-row={row.field
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')}
                className="align-top"
              >
                <td className="px-4 py-2 text-[11px] font-medium text-gray-200">
                  {row.field}
                </td>
                <td className="px-4 py-2 text-[10px] text-gray-400">{row.source}</td>
                <td className="px-4 py-2 text-[10px] text-gray-500">
                  {row.retrievalTime}
                </td>
                <td className="px-4 py-2">
                  <TruthStateChip
                    state={row.state}
                    sourceLabel={`${row.field} (${row.source})`}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-2 text-[10px] text-gray-400">
                  {row.reviewBoundary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
