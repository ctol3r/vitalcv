/**
 * Regression: no identity source may report an INACTIVE licence as ACTIVE, and
 * none may manufacture a status the source never sent.
 *
 * Three call sites classified a licence by substring with the affirmative arm
 * tested first:
 *
 *     statusStr.includes('ACTIVE') ? 'ACTIVE' : ...
 *
 * `'INACTIVE'.includes('ACTIVE')` is true, so every arm below it was
 * unreachable dead code and a licence the board reports as INACTIVE was
 * published as active. The same trap fired on 'NOT CURRENT' and — in the
 * certification ladder beside it — on 'NOT CERTIFIED', which read as CERTIFIED.
 * A fourth site defaulted an *absent* status to ACTIVE, fabricating a board
 * finding out of a missing field.
 *
 * These are load-bearing. `evidenceModel.ts` computes `hasActiveLicense` from
 * `licenseStatus === 'ACTIVE'`, and `fsmbClaimMapper` stamps
 * `PHYSICIAN_LICENSE_ACTIVE` / `BOARD_CERTIFIED` off the same values.
 *
 * INJECTION PROOF. Restoring any of the original ladders turns the matching
 * "does not read as ACTIVE" case red:
 *
 *   phase3Sources.ts (both sites)
 *     statusStr.includes('ACTIVE') ? 'ACTIVE' : ... ;  and
 *     String(event.status ?? event.licenseStatus ?? 'ACTIVE')
 *   fsmbClaimMapper.ts
 *     if (status.includes('ACTIVE')) return 'ACTIVE';
 *     if (status.includes('CERTIFIED')) return 'CERTIFIED';
 *
 * Each was re-injected and the corresponding cases below observed failing
 * before the fix was restored.
 */
jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { fetchFsmbClaims } from '../fsmbClaimMapper';
import {
  resolveCertificationStatus,
  resolveLicenseStatus,
} from '../licenseStatusVocabulary';
import { parseNursysResult, parseStateBoardResult } from '../phase3Sources';

const NPI = '1234567893';
const OBSERVED_AT = '2026-08-10T12:00:00.000Z';

function licenseValueOf(claim: { value: unknown }): Record<string, unknown> {
  return claim.value as Record<string, unknown>;
}

// ── The vocabulary itself ─────────────────────────────────────────────────────

describe('licenseStatusVocabulary fails closed', () => {
  it('resolves INACTIVE to EXPIRED, never ACTIVE', () => {
    const resolution = resolveLicenseStatus('INACTIVE');
    expect(resolution.status).not.toBe('ACTIVE');
    expect(resolution.status).toBe('EXPIRED');
    expect(resolution.recognized).toBe(true);
  });

  // Every one of these contains an affirmative substring, or was otherwise
  // capable of reaching the ACTIVE arm of the old ladder.
  it.each([
    'INACTIVE',
    'inactive',
    ' Inactive ',
    'IN-ACTIVE',
    'IN_ACTIVE',
    'NOT ACTIVE',
    'NOT_ACTIVE',
    'NOT CURRENT',
    'NOT-CURRENT',
    'NOT RENEWED',
    'DELINQUENT',
    'CANCELLED',
    'CLOSED',
    'RETIRED',
    'EXPIRED',
    'LAPSED',
    'REVOKED',
    'SUSPENDED',
    'SURRENDERED',
    'VOLUNTARY SURRENDER',
    'PROBATION',
    'RESTRICTED',
    'DECEASED',
    'DELINQUENT-INACTIVE',
    'ACTIVE - REVOKED',
  ])('never resolves %s to ACTIVE', (raw) => {
    expect(resolveLicenseStatus(raw).status).not.toBe('ACTIVE');
  });

  it.each([
    [undefined, null],
    [null, null],
    ['', null],
    ['   ', null],
  ])('treats an absent status (%s) as UNKNOWN rather than ACTIVE', (raw, expectedRaw) => {
    const resolution = resolveLicenseStatus(raw);
    expect(resolution.status).toBe('UNKNOWN');
    expect(resolution.recognized).toBe(false);
    expect(resolution.raw).toBe(expectedRaw);
  });

  it('keeps an unrecognized status distinguishable from an absent one', () => {
    const unrecognized = resolveLicenseStatus('SURRENDERED');
    expect(unrecognized.status).toBe('UNKNOWN');
    expect(unrecognized.recognized).toBe(false);
    expect(unrecognized.raw).toBe('SURRENDERED');
  });

  it.each(['ACTIVE', 'active', '  Active  ', 'ACTIVE IN RENEWAL', 'CURRENT'])(
    'resolves the affirmative status %s to ACTIVE',
    (raw) => {
      const resolution = resolveLicenseStatus(raw);
      expect(resolution.status).toBe('ACTIVE');
      expect(resolution.recognized).toBe(true);
    },
  );

  it('resolves NOT CERTIFIED to NOT_CERTIFIED, never CERTIFIED', () => {
    const resolution = resolveCertificationStatus('NOT CERTIFIED');
    expect(resolution.status).not.toBe('CERTIFIED');
    expect(resolution.status).toBe('NOT_CERTIFIED');
  });

  it.each([
    'NOT CERTIFIED',
    'NOT_CERTIFIED',
    'not certified',
    'NEVER CERTIFIED',
    'NON-CERTIFIED',
    'UNCERTIFIED',
    'LAPSED',
    'EXPIRED',
  ])('never resolves the certification status %s to CERTIFIED', (raw) => {
    expect(resolveCertificationStatus(raw).status).not.toBe('CERTIFIED');
  });

  it('resolves CERTIFIED to CERTIFIED', () => {
    expect(resolveCertificationStatus('CERTIFIED').status).toBe('CERTIFIED');
  });

  it('treats an absent certification status as UNKNOWN rather than CERTIFIED', () => {
    expect(resolveCertificationStatus(undefined).status).toBe('UNKNOWN');
  });
});

// ── Site 1: Nursys (phase3Sources.parseNursysResult) ─────────────────────────

describe('parseNursysResult does not fabricate an active nurse licence', () => {
  function parse(event: Record<string, unknown>) {
    return parseNursysResult(
      NPI,
      { events: [event] },
      'artifact-1',
      'checksum-1',
      OBSERVED_AT,
    );
  }

  it('does not report ACTIVE for INACTIVE (the original defect)', () => {
    const { claims } = parse({ state: 'TX', licenseNumber: 'TX-1', status: 'INACTIVE' });

    expect(claims).toHaveLength(1);
    expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('EXPIRED');
  });

  it.each(['NOT CURRENT', 'DELINQUENT-INACTIVE', 'SURRENDERED', 'PROBATION'])(
    'does not report ACTIVE for %s',
    (status) => {
      const { claims } = parse({ state: 'TX', status });
      expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    },
  );

  // The absent-status default: `event.status ?? event.licenseStatus ?? 'ACTIVE'`
  // asserted a licence status the source never sent.
  it('does not report ACTIVE when the event carries no status at all', () => {
    const { claims } = parse({ state: 'TX', licenseNumber: 'TX-1' });

    expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('UNKNOWN');
    expect(claims[0]!.reviewRequired).toBe(true);
    expect(claims[0]!.reviewReason).toContain('no license status');
    expect(claims[0]!.status).toBe('UNVERIFIED');
  });

  it('marks an unrecognized status for review rather than asserting it', () => {
    const { claims, receipts } = parse({ state: 'TX', status: 'SURRENDERED' });

    expect(claims[0]!.reviewRequired).toBe(true);
    expect(claims[0]!.reviewReason).toContain('SURRENDERED');
    expect(claims[0]!.confidence).toBe('UNCERTAIN');
    expect(receipts[0]!.explanation).toContain('SURRENDERED');
  });

  // A disciplinary event is not evidence the licence is active.
  it('does not report ACTIVE for a discipline event that is neither revocation nor suspension', () => {
    const { claims } = parse({ state: 'TX', eventType: 'Disciplinary Action - Probation' });

    expect(claims[0]!.claimType).toBe('NURSING_DISCIPLINE');
    expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('UNKNOWN');
  });

  it('still reports ACTIVE for an explicit ACTIVE status', () => {
    const { claims } = parse({
      state: 'TX', licenseNumber: 'TX-123', status: 'ACTIVE', expirationDate: '2028-01-01',
    });

    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('ACTIVE');
    expect(claims[0]!.confidence).toBe('HIGH');
    expect(claims[0]!.reviewRequired).toBe(false);
    expect(claims[0]!.status).toBe('ACTIVE');
  });
});

// ── Site 2: state board / FSMB (phase3Sources.parseStateBoardResult) ─────────

describe('parseStateBoardResult does not fabricate an active physician licence', () => {
  function parse(license: Record<string, unknown>) {
    return parseStateBoardResult(
      NPI,
      'CA',
      { _source: 'FSMB', licenses: [license] },
      'artifact-2',
      'checksum-2',
      OBSERVED_AT,
    );
  }

  it('does not report ACTIVE for INACTIVE (the original defect)', () => {
    const { claims } = parse({ state: 'CA', licenseNumber: 'A-1', status: 'INACTIVE' });

    expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('EXPIRED');
  });

  it.each(['NOT CURRENT', 'DELINQUENT-INACTIVE', 'SURRENDERED', 'RESTRICTED'])(
    'does not report ACTIVE for %s',
    (status) => {
      const { claims } = parse({ state: 'CA', status });
      expect(licenseValueOf(claims[0]!).licenseStatus).not.toBe('ACTIVE');
    },
  );

  it('leaves an unrecognized status unresolved and flagged, not active', () => {
    const { claims } = parse({ state: 'CA', status: 'SURRENDERED' });

    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('UNKNOWN');
    expect(claims[0]!.status).toBe('UNVERIFIED');
    expect(claims[0]!.reviewRequired).toBe(true);
    expect(claims[0]!.reviewReason).toContain('SURRENDERED');
  });

  it('does not report ACTIVE when the licence record carries no status', () => {
    const { claims } = parse({ state: 'CA', licenseNumber: 'A-1' });

    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('UNKNOWN');
    expect(claims[0]!.status).toBe('UNVERIFIED');
    expect(claims[0]!.reviewRequired).toBe(true);
  });

  it('does not stamp a disciplinary claim as an active licence', () => {
    const { claims } = parse({
      state: 'CA', licenseNumber: 'A-1', status: 'INACTIVE',
      disciplinaryActions: ['Consent order'],
    });

    const discipline = claims.find((claim) => claim.claimType === 'LICENSE_DISCIPLINE');
    expect(discipline).toBeDefined();
    expect(licenseValueOf(discipline!).licenseStatus).not.toBe('ACTIVE');
  });

  it('still reports ACTIVE for an explicit ACTIVE status', () => {
    const { claims } = parse({
      state: 'CA', licenseNumber: 'A-9', status: 'ACTIVE', expirationDate: '2028-01-01',
    });

    expect(licenseValueOf(claims[0]!).licenseStatus).toBe('ACTIVE');
    expect(claims[0]!.status).toBe('ACTIVE');
    expect(claims[0]!.reviewRequired).toBe(false);
  });
});

// ── Site 3: FSMB claim mapper (fsmbClaimMapper.fetchFsmbClaims) ──────────────

describe('fetchFsmbClaims does not fabricate active licences or certifications', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FSMB_ENABLED = 'true';
    process.env.FSMB_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.FSMB_ENABLED;
    delete process.env.FSMB_API_KEY;
  });

  function mockDocInfo(payload: Record<string, unknown>): void {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    }) as unknown as typeof global.fetch;
  }

  async function licenseClaimFor(status: unknown) {
    mockDocInfo({
      medicalLicenses: [{ state: 'CA', licenseNumber: 'CA-1', status }],
    });
    const result = await fetchFsmbClaims(NPI, OBSERVED_AT);
    return result.claims.find((claim) => claim.claimType === 'LICENSE');
  }

  async function certClaimFor(certificationStatus: unknown) {
    mockDocInfo({
      boardCertifications: [
        { certifyingBoard: 'ABIM', specialty: 'Internal Medicine', certificationStatus },
      ],
    });
    const result = await fetchFsmbClaims(NPI, OBSERVED_AT);
    return result.claims.find((claim) => claim.claimType === 'BOARD_CERTIFICATION');
  }

  it('does not report ACTIVE for INACTIVE (the original defect)', async () => {
    const claim = await licenseClaimFor('INACTIVE');

    expect(claim).toBeDefined();
    expect(licenseValueOf(claim!).licenseStatus).not.toBe('ACTIVE');
    expect(licenseValueOf(claim!).licenseStatus).toBe('EXPIRED');
    // The downstream affirmative must not be stamped either.
    expect(licenseValueOf(claim!).authorityClaimCode).toBeUndefined();
    expect(claim!.status).toBe('EXPIRED');
  });

  it.each(['NOT CURRENT', 'DELINQUENT-INACTIVE', 'SURRENDERED', 'PROBATION'])(
    'does not report ACTIVE for %s',
    async (status) => {
      const claim = await licenseClaimFor(status);
      expect(licenseValueOf(claim!).licenseStatus).not.toBe('ACTIVE');
      expect(licenseValueOf(claim!).authorityClaimCode).toBeUndefined();
    },
  );

  it('does not report ACTIVE when FSMB sends no status', async () => {
    const claim = await licenseClaimFor(undefined);

    expect(licenseValueOf(claim!).licenseStatus).toBe('UNKNOWN');
    expect(claim!.status).toBe('UNVERIFIED');
    expect(claim!.reviewRequired).toBe(true);
    expect(claim!.reviewReason).toContain('no license status');
  });

  it('flags an unrecognized status for review alongside any board order', async () => {
    const claim = await licenseClaimFor('SURRENDERED');

    expect(licenseValueOf(claim!).licenseStatus).toBe('UNKNOWN');
    expect(claim!.reviewRequired).toBe(true);
    expect(claim!.reviewReason).toContain('SURRENDERED');
  });

  it('still reports ACTIVE for an explicit ACTIVE status', async () => {
    const claim = await licenseClaimFor('ACTIVE');

    expect(licenseValueOf(claim!).licenseStatus).toBe('ACTIVE');
    expect(licenseValueOf(claim!).authorityClaimCode).toBe('PHYSICIAN_LICENSE_ACTIVE');
    expect(claim!.status).toBe('ACTIVE');
    expect(claim!.reviewRequired).toBe(false);
  });

  it('does not report CERTIFIED for NOT CERTIFIED (the certification defect)', async () => {
    const claim = await certClaimFor('NOT CERTIFIED');

    expect(claim).toBeDefined();
    expect(licenseValueOf(claim!).certificationStatus).not.toBe('CERTIFIED');
    expect(licenseValueOf(claim!).certificationStatus).toBe('NOT_CERTIFIED');
    expect(licenseValueOf(claim!).authorityClaimCode).toBeUndefined();
    expect(claim!.status).toBe('UNVERIFIED');
  });

  it.each(['NOT_CERTIFIED', 'NEVER CERTIFIED', 'UNCERTIFIED'])(
    'does not report CERTIFIED for %s',
    async (status) => {
      const claim = await certClaimFor(status);
      expect(licenseValueOf(claim!).certificationStatus).not.toBe('CERTIFIED');
      expect(licenseValueOf(claim!).authorityClaimCode).toBeUndefined();
    },
  );

  it('does not report CERTIFIED when FSMB sends no certification status', async () => {
    const claim = await certClaimFor(undefined);

    expect(licenseValueOf(claim!).certificationStatus).toBe('UNKNOWN');
    expect(licenseValueOf(claim!).authorityClaimCode).toBeUndefined();
  });

  it('still reports CERTIFIED for an explicit CERTIFIED status', async () => {
    const claim = await certClaimFor('CERTIFIED');

    expect(licenseValueOf(claim!).certificationStatus).toBe('CERTIFIED');
    expect(licenseValueOf(claim!).authorityClaimCode).toBe('BOARD_CERTIFIED');
    expect(claim!.status).toBe('ACTIVE');
  });
});
