import * as React from 'react';
import { TruthStateChip } from '@/design-system/components/TruthStateChip';
import type { TruthStateKind } from '@/design-system/components/TruthStateChip';

/**
 * ConnectorMatrix — receipt-document table of which source connectors
 * are currently live, gated, or intentionally not connected in the
 * current build.
 *
 * Read-only. Statically declared. Each row's state is set from the
 * known/observed state of the current build — not from product
 * marketing. NPPES, OIG/LEIE, PECOS, STATE_BOARD, FSMB, NURSYS each
 * own their own row.
 *
 * WHAT THIS TABLE MEASURES. Not lane capability — the *access boundary* an
 * anonymous visitor hits. `SOURCE_LANE_OPS` (rendered by SourceLaneTelemetry
 * further down this page) answers "is the lane wired and returning data".
 * This answers "can you, with no session, get a result". Both can be true at
 * once, which is why the two tables can legitimately differ; the page labels
 * each axis so a reader does not mistake that for a contradiction.
 *
 * Truth-contract guarantees (enforced by
 * `apps/web/__tests__/connector-matrix.test.tsx`):
 *  - NPPES is "source-backed". Corrected 2026-07-26. It previously said
 *    "temporarily-unavailable", on the premise that the proxy gates
 *    `POST /api/ingest/:npi` for non-operator sessions. Measured against
 *    production, that premise is false: anonymously,
 *    `/api/identity/bootstrap/:npi` returns 200 with NPPES-derived fields and
 *    `/api/trust-state/:npi` reports `NPPES_API` in state `checked`, carrying
 *    a live `npiregistry.cms.hhs.gov` source URL and a real `checkedAt`.
 *  - OIG / LEIE is "snapshot-only". Corrected 2026-07-26. It previously said
 *    "auth-required — results require an authenticated session"; that is also
 *    false. Anonymously, NPI 1215930367 returns `OIG_LEIE` in state `checked`
 *    with "OIG LEIE check clear". The real precondition is an active NPPES
 *    identity match, not a session — an NPI that returns no active identity
 *    reports `pending / gated on an active NPPES identity match`. The chip is
 *    "snapshot-only" rather than "source-backed" because the lane reads a
 *    monthly LEIE cache (`SOURCE_LANE_OPS.readCadence: 'monthly_snapshot'`),
 *    so a clear result is a snapshot, never a live read.
 *  - CMS PECOS stays "auth-required" — NOT verified, deliberately unchanged.
 *    PECOS reported `pending / not yet checked` on every anonymous probe,
 *    including one with an active identity match, so there was no evidence
 *    either to confirm the session claim or to correct it. Understating an
 *    unmeasured lane is the safe direction; upgrading it on a guess is not.
 *  - STATE_BOARD is "access-required" (per-jurisdiction agreements);
 *    FSMB and NURSYS remain "connector-not-live" — genuinely unwired.
 *  - The matrix MUST NOT claim a connector is live unless the build
 *    has evidence. Any future row that flips to "source-backed" needs
 *    a backend-confirmed adapter, not a copy change. The inverse is
 *    equally binding: do not say "not live" about an adapter that runs.
 *    Understating is not a safe default — it published a contradiction.
 */

export interface ConnectorRow {
  connector: string;
  state: TruthStateKind;
  /** Plain-language description of what the row currently observes. */
  observation: string;
  /** What the operator should interpret from this state. */
  interpretation: string;
}

export const CONNECTOR_MATRIX_ROWS: ReadonlyArray<ConnectorRow> = Object.freeze([
  {
    // Corrected 2026-07-26: "temporarily-unavailable" was false. Measured
    // anonymously against production, NPPES is read per request and reported
    // as `checked` with a live registry URL. See the header block.
    connector: 'NPPES (Federal NPI Registry)',
    state: 'source-backed',
    observation:
      'Identity lane. Read per request against the federal NPI registry, with no session required.',
    interpretation:
      'A returned identity is NPPES-backed as of the timestamp shown. NPPES describes registration, not licensure, standing, or fitness to practise.',
  },
  {
    // Corrected 2026-07-25: "no live upstream wiring" was false. The adapter
    // reads the real HHS LEIE CSV unless OIG_LEIE_ENABLED === 'false', which
    // is unset on Railway (founder-confirmed).
    // Corrected again 2026-07-26: "auth-required" was also false — the lane
    // returns a clear result to an anonymous caller. The precondition is an
    // active NPPES identity match, not a session.
    connector: 'OIG / LEIE (Federal Exclusion Lane)',
    state: 'snapshot-only',
    observation:
      'Reads a monthly HHS LEIE snapshot cache. Runs once NPPES returns an active identity match — no session required. Without that match it reports pending, not clear.',
    interpretation:
      'A clear result reflects the most recent monthly snapshot, not a live read, and is not a clearance. Do not treat the absence of an exclusion result as one. Institution review still applies.',
  },
  {
    connector: 'CMS PECOS (Medicare Enrollment Lane)',
    state: 'auth-required',
    observation:
      'Pipeline calls the CMS data.gov dataset upstream. Results require an authenticated session.',
    interpretation:
      'Institution review may require separate enrollment evidence; this lane does not assert it.',
  },
  {
    connector: 'State Medical Boards',
    state: 'access-required',
    observation:
      'Per-jurisdiction adapters; many require operator-side authorization before a read.',
    interpretation:
      'Some state-board adapters need operator credentials to query. Unavailable here is a workflow gate, not a finding about the clinician.',
  },
  {
    connector: 'FSMB Practitioner Lookup',
    state: 'connector-not-live',
    observation: 'Adapter scoped but not wired in this build.',
    interpretation: 'No FSMB result is asserted by VitalCV in this build.',
  },
  {
    connector: 'Nursys (Nurse License Database)',
    state: 'connector-not-live',
    observation: 'Adapter scoped but not wired in this build.',
    interpretation: 'No Nursys result is asserted by VitalCV in this build.',
  },
] as const);

export interface ConnectorMatrixProps {
  rows?: ReadonlyArray<ConnectorRow>;
  className?: string;
}

/**
 * Render a receipt-document table of connector states.
 */
export function ConnectorMatrix({
  rows = CONNECTOR_MATRIX_ROWS,
  className,
}: ConnectorMatrixProps) {
  return (
    <section
      data-status-connector-matrix=""
      aria-labelledby="connector-matrix-heading"
      className={className}
    >
      <h2
        id="connector-matrix-heading"
        className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
      >
        Connector matrix
      </h2>
      <p className="mt-1 text-[10px] text-gray-500">
        Per-source state, last-checked context, and operator interpretation.
        Statically declared; build-evidence-backed.
      </p>
      <div className="mt-3 overflow-hidden border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-[9px] uppercase tracking-widest text-gray-600">
              <th className="px-4 py-1.5 text-left font-normal">Connector</th>
              <th className="px-4 py-1.5 text-left font-normal">State</th>
              <th className="px-4 py-1.5 text-left font-normal">Observation</th>
              <th className="px-4 py-1.5 text-left font-normal">Interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {rows.map((row) => (
              <tr
                key={row.connector}
                data-status-connector-row={row.connector
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')}
                className="align-top"
              >
                <td className="px-4 py-2 text-[11px] font-medium text-gray-200">
                  {row.connector}
                </td>
                <td className="px-4 py-2">
                  <TruthStateChip
                    state={row.state}
                    sourceLabel={row.connector}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-2 text-[10px] text-gray-400">
                  {row.observation}
                </td>
                <td className="px-4 py-2 text-[10px] text-gray-400">
                  {row.interpretation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
