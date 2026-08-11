/**
 * NCCPA / state-board PSV placeholders.
 *
 * FAIL-CLOSED CONTRACT. Both functions previously returned a positive status
 * unconditionally — `verifyNCCPA` returned CERTIFIED and `verifyStateBoard`
 * returned ACTIVE for every input, alongside a `lastChecked` stamped from the
 * request clock and an `expirationDate` invented as today + 2 years. Nothing
 * was read from any source. A caller wiring these would have published a
 * fabricated primary-source verification: ACTIVE/CERTIFIED is mapped to
 * `VERIFIED` in app.ts and counted toward `readinessScore` in
 * psvOrchestrator.ts.
 *
 * This is the same defect fixed in the FSMB and Nursys adapters — see
 * `adapters/__tests__/adapterFailClosed.test.ts`. These two were missed by that
 * sweep. They are now honest: there is no NCCPA or state-board integration on
 * this path, so they report ERROR and carry no invented dates.
 *
 * ERROR, never NOT_FOUND. "We could not look" is not "no certification exists"
 * — NOT_FOUND is a finding about the practitioner, and these functions have no
 * grounds to make one.
 *
 * Worth building for real: NCCPA is one of the few issuers offering real-time
 * public primary-source verification, at https://portal.nccpa.net/verifypac
 * (see apps/web/lib/credential-vocabulary/definitions.ts, the `pa-c` entry).
 * A genuine adapter should replace `verifyNCCPA` wholesale rather than relax
 * the contract below.
 *
 * `verifyStateBoard` here is dead duplicate scaffolding: the real, wired
 * state-board path is `services/providers/connectors/stateBoardConnector.ts`
 * (`lookupStateBoard`, called from credentialIngestionService.ts), with the CA
 * live lookup in `connectors/caBreezeLiveLookup.ts`. Prefer those. This one is
 * kept only so the export does not vanish from under a future caller; it should
 * be deleted once that is confirmed safe.
 */

export type NCCPAStatus = 'CERTIFIED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';

export interface NCCPAResult {
  status: NCCPAStatus;
  /** ISO timestamp of a completed source read. `null` when no read occurred. */
  lastChecked: string | null;
  /** Present only when `status` is ERROR. Explains why nothing was verified. */
  reason?: string;
}

/**
 * Named `StateBoardPlaceholder*` deliberately. Three unrelated `StateBoardResult`
 * types already exist in this backend — in `src/agents/types.ts`,
 * `src/workers/psvOrchestrator.ts`, and `connectors/stateBoardConnector.ts`.
 * A fourth would invite a wrong auto-import, and this is the one nobody should
 * be importing.
 */
export type StateBoardPlaceholderStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

export interface StateBoardPlaceholderResult {
  status: StateBoardPlaceholderStatus;
  /** Expiry as reported by the board. `null` when no read occurred. */
  expirationDate: string | null;
  /** Present only when `status` is ERROR. Explains why nothing was verified. */
  reason?: string;
}

const NOT_IMPLEMENTED_NCCPA =
  'NCCPA primary-source verification is not implemented. No certification status was read.';

const NOT_IMPLEMENTED_STATE_BOARD =
  'State-board primary-source verification is not implemented here. No licence status was read.';

/**
 * Fails closed. Returns ERROR unconditionally because no NCCPA lookup exists.
 * It must never return CERTIFIED without a response from NCCPA saying so.
 */
export async function verifyNCCPA(_npi: string, _stateId: string): Promise<NCCPAResult> {
  return {
    status: 'ERROR',
    lastChecked: null,
    reason: NOT_IMPLEMENTED_NCCPA,
  };
}

/**
 * Fails closed. Returns ERROR unconditionally because no state-board lookup
 * exists on this path. It must never return ACTIVE, nor invent an expiry date,
 * without a response from the board.
 */
export async function verifyStateBoard(
  _state: string,
  _licenseNumber: string,
): Promise<StateBoardPlaceholderResult> {
  return {
    status: 'ERROR',
    expirationDate: null,
    reason: NOT_IMPLEMENTED_STATE_BOARD,
  };
}
