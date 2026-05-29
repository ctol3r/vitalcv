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
 * Truth-contract guarantees (enforced by
 * `apps/web/__tests__/connector-matrix.test.tsx`):
 *  - NPPES is "temporarily-unavailable" by default — this matches the
 *    public unauthenticated state observed by Browser (the upstream
 *    proxy gates `POST /api/ingest/:npi` for non-operator sessions).
 *    The chip never claims NPPES is "Live" or "Source-backed" — that
 *    requires an authenticated SSE payload, which is a per-request
 *    behavior, not a matrix state.
 *  - OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS all render
 *    "connector-not-live" — none are wired to live upstream services
 *    in the current build.
 *  - The matrix MUST NOT claim a connector is live unless the build
 *    has evidence. Any future row that flips to "source-backed" needs
 *    a backend-confirmed adapter, not a copy change.
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
    connector: 'NPPES (Federal NPI Registry)',
    state: 'temporarily-unavailable',
    observation:
      'Identity-only proxy. Returns a payload when authenticated; gated otherwise.',
    interpretation:
      'When NPPES returns a payload with displayName, identityStatus, and entityId, the row promotes to source-backed for that specific run. The matrix state reflects the gateway, not a single ingest call.',
  },
  {
    connector: 'OIG / LEIE (Federal Exclusion Lane)',
    state: 'connector-not-live',
    observation: 'Adapter exists in code; no live upstream wiring in this build.',
    interpretation:
      'Do not treat the absence of an exclusion result as a clearance. Institution review still applies.',
  },
  {
    connector: 'CMS PECOS (Medicare Enrollment Lane)',
    state: 'connector-not-live',
    observation: 'Adapter exists in code; no live upstream wiring in this build.',
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
