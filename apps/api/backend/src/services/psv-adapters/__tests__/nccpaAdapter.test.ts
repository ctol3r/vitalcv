/**
 * Regression: the NCCPA and state-board placeholders must never manufacture a
 * positive verification result.
 *
 * The original defect: `verifyNCCPA` returned `{ status: 'CERTIFIED' }` and
 * `verifyStateBoard` returned `{ status: 'ACTIVE' }` unconditionally, for every
 * input, having read nothing from any source. Both also carried invented data —
 * a `lastChecked` stamped from the request clock and an `expirationDate` set to
 * today + 2 years — which made an unverified result look source-backed.
 *
 * That matters because a positive status is not inert downstream:
 *   - `app.ts` maps an ACTIVE artifact status to `VERIFIED`
 *   - `psvOrchestrator.ts` counts ACTIVE artifacts into `readinessScore`
 *
 * Same defect class as the FSMB/Nursys fix in
 * `../adapters/__tests__/adapterFailClosed.test.ts`; these two were missed by
 * that sweep. Nothing wires them today, so the tests below are what stops the
 * fabrication from returning when someone does.
 */
import {
  verifyNCCPA,
  verifyStateBoard,
  type NCCPAResult,
  type StateBoardPlaceholderResult,
} from '../adapters/nccpaAdapter';

/**
 * Inputs a caller could plausibly pass, including ones a fabricating
 * implementation would happily "certify": a valid NPI, an NPI that fails the
 * Luhn check digit, a fabricated-looking one, and empty strings.
 */
const NCCPA_INPUTS: ReadonlyArray<readonly [npi: string, stateId: string]> = [
  ['1234567893', 'CA-123'],
  ['1234567890', 'CA-123'],
  ['0000000000', ''],
  ['', ''],
];

const STATE_BOARD_INPUTS: ReadonlyArray<readonly [state: string, licenseNumber: string]> = [
  ['CA', 'MD12345'],
  ['TX', 'NOT-A-REAL-LICENCE'],
  ['', ''],
];

describe('verifyNCCPA fails closed', () => {
  it.each(NCCPA_INPUTS)('reports ERROR, never CERTIFIED, for npi=%p stateId=%p', async (npi, stateId) => {
    const res: NCCPAResult = await verifyNCCPA(npi, stateId);

    // The original defect, stated directly.
    expect(res.status).not.toBe('CERTIFIED');
    expect(res.status).toBe('ERROR');
  });

  it('does not report NOT_FOUND — failing to look is not evidence of no certification', async () => {
    const res = await verifyNCCPA('1234567893', 'CA-123');
    expect(res.status).not.toBe('NOT_FOUND');
  });

  it('invents no check timestamp', async () => {
    // `lastChecked: new Date().toISOString()` was the request clock, not a read.
    const res = await verifyNCCPA('1234567893', 'CA-123');
    expect(res.lastChecked).toBeNull();
  });

  it('says why nothing was verified', async () => {
    const res = await verifyNCCPA('1234567893', 'CA-123');
    expect(res.reason).toMatch(/not implemented/i);
  });
});

describe('verifyStateBoard fails closed', () => {
  it.each(STATE_BOARD_INPUTS)('reports ERROR, never ACTIVE, for state=%p licence=%p', async (state, licenceNumber) => {
    const res: StateBoardPlaceholderResult = await verifyStateBoard(state, licenceNumber);

    // The original defect, stated directly.
    expect(res.status).not.toBe('ACTIVE');
    expect(res.status).toBe('ERROR');
  });

  it('invents no expiration date', async () => {
    // The fabricating body returned today + 2 years for any input.
    const res = await verifyStateBoard('CA', 'MD12345');
    expect(res.expirationDate).toBeNull();
  });

  it('says why nothing was verified', async () => {
    const res = await verifyStateBoard('CA', 'MD12345');
    expect(res.reason).toMatch(/not implemented/i);
  });
});
