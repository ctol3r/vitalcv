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
 * `apps/web/__tests__/status-attribution-receipts.test.tsx`):
 *  - Every "Review boundary" cell either says "institution review" or
 *    "n/a" — never "verified", never "cleared", never "approved".
 *  - NPPES rows say `source-backed`; OIG / PECOS / STATE_BOARD /
 *    FSMB / NURSYS rows never claim `source-backed`. That guarantee is
 *    unchanged by the 2026-07-25 correction below: `auth-required` is
 *    still not a claim that anything was retrieved.
 *
 *    2026-07-26: the three NPPES rows previously said
 *    `temporarily-unavailable`, whose meaning is "the source did not
 *    return a payload on this attempt". That was false and it
 *    UNDERSTATED a lane that works. Production returns a usable NPPES
 *    payload on every attempt — `GET /api/passport/npi/<npi>` yields
 *    `nppes_identity state=checked` with a `checkedAt` in the same
 *    second as the request, reproducible across NPIs — and the
 *    registry agrees (`sourceLanes.ts`: lifecycle `active`,
 *    readCadence `per_request`, "Live NPPES registry lookups").
 *    `source-backed` means exactly "a primary source returned a usable
 *    payload for this field", which is the true statement.
 *
 *    Note the deliberate asymmetry with `ConnectorMatrix`, which still
 *    asserts the NPPES row is NOT `source-backed`: that surface is
 *    connector-level (does a connector exist and run), this one is
 *    field-level (did we read this field on this request). Both are
 *    correct at their own altitude; do not "reconcile" them.
 *  - A row may only say `connector-not-live` when no live upstream
 *    adapter exists. "Live but gated" is `auth-required` or
 *    `access-required`. Understating capability is not a safe default
 *    here — it published a contradiction against `/api/status`.
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
    retrievalTime: 'on profile read; per request',
    state: 'source-backed',
    reviewBoundary: 'institution review',
  },
  {
    field: 'NPI',
    source: 'operator-entered',
    retrievalTime: 'at /onboarding input',
    state: 'source-backed',
    reviewBoundary: 'n/a',
  },
  {
    field: 'Identity status',
    source: 'NPPES',
    retrievalTime: 'on profile read; per request',
    state: 'source-backed',
    reviewBoundary: 'institution review',
  },
  {
    field: 'Taxonomy / specialty',
    source: 'NPPES',
    retrievalTime: 'on profile read; per request',
    state: 'source-backed',
    reviewBoundary: 'institution review',
  },
  {
    // Corrected 2026-07-25. These two said `connector not live`, which was
    // FALSE: `OigLeieAdapter.ts:79` reads the real HHS LEIE CSV unless
    // `OIG_LEIE_ENABLED === 'false'` (founder-confirmed unset on Railway), and
    // `fetchPecos` calls the CMS data.gov dataset with no env gate at all. The
    // connectors ARE live. What is true is that this surface cannot show a
    // result without a session: `/api/psv/oig/check/[npi]` proxies to the
    // backend and returns 401 unauthenticated (verified on production).
    // `auth-required`, not `connector-not-live` — the distinction matters
    // because "no connector" reads as a capability VitalCV lacks, when the
    // real boundary is consent and authentication.
    field: 'OIG / LEIE exclusion result',
    source: 'OIG / LEIE',
    retrievalTime: 'not retrieved without sign-in (connector live)',
    state: 'auth-required',
    reviewBoundary: 'institution review',
  },
  {
    field: 'CMS PECOS enrollment',
    source: 'CMS PECOS',
    retrievalTime: 'not retrieved without sign-in (connector live)',
    state: 'auth-required',
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
        className="text-[10px] font-bold uppercase tracking-widest text-[var(--vt-text-secondary)]"
      >
        Per-field attribution
      </h2>
      <p className="mt-1 text-[10px] text-[var(--vt-text-muted)]">
        Each row: field, source, when we read it, current state, who decides.
      </p>
      <div className="mt-3 overflow-hidden border border-[var(--vt-border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--vt-border)] text-[9px] uppercase tracking-widest text-[var(--vt-text-muted)]">
              <th className="px-4 py-1.5 text-left font-normal">Field</th>
              <th className="px-4 py-1.5 text-left font-normal">Source</th>
              <th className="px-4 py-1.5 text-left font-normal">Retrieval time</th>
              <th className="px-4 py-1.5 text-left font-normal">State</th>
              <th className="px-4 py-1.5 text-left font-normal">Review boundary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vt-border)]">
            {rows.map((row) => (
              <tr
                key={row.field}
                data-trust-attribution-row={row.field
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')}
                className="align-top"
              >
                <td className="px-4 py-2 text-[11px] font-medium text-[var(--vt-text-primary)]">
                  {row.field}
                </td>
                <td className="px-4 py-2 text-[10px] text-[var(--vt-text-secondary)]">{row.source}</td>
                <td className="px-4 py-2 text-[10px] text-[var(--vt-text-muted)]">
                  {row.retrievalTime}
                </td>
                <td className="px-4 py-2">
                  <TruthStateChip
                    state={row.state}
                    sourceLabel={`${row.field} (${row.source})`}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-2 text-[10px] text-[var(--vt-text-secondary)]">
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
