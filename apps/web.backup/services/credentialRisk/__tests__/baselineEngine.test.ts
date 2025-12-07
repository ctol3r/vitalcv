import { runBaselineRules, BaselineRiskData } from '../baselineEngine';
import { CredentialRiskFactors } from '../enums';

const AS_OF = new Date('2025-01-01T00:00:00Z');

function buildData(overrides: Partial<BaselineRiskData> = {}): BaselineRiskData {
  return {
    clinicianId: 'clin-001',
    clinicianDid: 'did:example:123',
    homeState: 'CA',
    psvResult: undefined,
    licenses: [],
    pecosEnrollments: [],
    deaCredentials: [{ status: 'ACTIVE', expiresAt: new Date('2026-01-01T00:00:00Z') }],
    boardCredentials: [{ status: 'ACTIVE', expiresAt: new Date('2026-06-01T00:00:00Z') }],
    revalidationTasks: [],
    npdbFindings: [],
    compacts: null,
    oppeCases: [],
    fppeSummary: undefined,
    ...overrides,
  };
}

describe('baseline credential risk rules', () => {
  it('returns zero score for clinicians with a clean record', () => {
    const result = runBaselineRules(buildData(), AS_OF);
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it('flags expired state licenses', () => {
    const result = runBaselineRules(
      buildData({
        licenses: [
          {
            state: 'CA',
            status: 'EXPIRED',
            expiryDate: new Date('2024-10-01T00:00:00Z'),
            disciplinaryFlag: false,
          },
        ],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.LICENSE_EXPIRED);
  });

  it('flags license issues originating from revalidation tasks', () => {
    const result = runBaselineRules(
      buildData({
        revalidationTasks: [{ status: 'OPEN', category: 'STATE_LICENSE', metadata: null }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.LICENSE_EXPIRED);
  });

  it('flags DEA expiration when the credential is past due', () => {
    const result = runBaselineRules(
      buildData({
        deaCredentials: [{ status: 'ACTIVE', expiresAt: new Date('2024-12-31T00:00:00Z') }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.DEA_EXPIRED);
  });

  it('flags DEA when an open revalidation task exists even if the credential is active', () => {
    const result = runBaselineRules(
      buildData({
        deaCredentials: [{ status: 'ACTIVE', expiresAt: new Date('2026-01-01T00:00:00Z') }],
        revalidationTasks: [{ status: 'OPEN', category: 'DEA', metadata: null }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.DEA_EXPIRED);
  });

  it('flags board certification lapses', () => {
    const result = runBaselineRules(
      buildData({
        boardCredentials: [{ status: 'LAPSED', expiresAt: new Date('2024-01-01T00:00:00Z') }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.BOARD_EXPIRED);
  });

  it('flags PECOS revocations', () => {
    const result = runBaselineRules(
      buildData({
        pecosEnrollments: [{ enrollmentType: 'CMS855I', status: 'DEACTIVATED' }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.PECOS_REVOKED);
  });

  it('flags sanction events coming from PSV results', () => {
    const result = runBaselineRules(
      buildData({
        psvResult: { overallStatus: 'FAIL', sanctionFlag: true, licenseStatus: 'ACTIVE' },
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.SANCTION_FLAG);
  });

  it('flags NPDB adverse actions separately from sanctions', () => {
    const result = runBaselineRules(
      buildData({
        npdbFindings: [{ status: 'ADVERSE_ACTION' }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.NPDB_HIT);
  });

  it('flags low OPPE performance when a case fails', () => {
    const result = runBaselineRules(
      buildData({
        oppeCases: [{ status: 'FAILED', metrics: { issuesFlagged: 2 } }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.LOW_OPPE);
  });

  it('flags failed FPPE timelines', () => {
    const result = runBaselineRules(
      buildData({
        fppeSummary: { fppeStatus: 'FAILED', fppeEndDate: new Date('2024-06-01T00:00:00Z') },
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.FAILED_FPPE);
  });

  it('flags out-of-state practice gaps when no compact coverage exists', () => {
    const result = runBaselineRules(
      buildData({
        licenses: [
          {
            state: 'NV',
            status: 'EXPIRED',
            expiryDate: new Date('2023-01-01T00:00:00Z'),
            disciplinaryFlag: false,
          },
        ],
        compacts: {
          imlcStates: [],
          psypactStates: [],
          counselingStates: [],
          imlcStatus: 'NOT_ELIGIBLE',
        },
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.OUT_OF_STATE_WITHOUT_COMPACT);
  });

  it('flags multiple disciplinary actions when two or more signals exist', () => {
    const result = runBaselineRules(
      buildData({
        licenses: [
          {
            state: 'CA',
            status: 'ACTIVE',
            expiryDate: new Date('2026-01-01T00:00:00Z'),
            disciplinaryFlag: true,
          },
        ],
        npdbFindings: [{ status: 'ADVERSE_ACTION' }],
      }),
      AS_OF
    );
    expect(result.factors).toContain(CredentialRiskFactors.MULTIPLE_DISCIPLINARY_ACTIONS);
  });

  it('caps the score at 100 even when many severe factors fire', () => {
    const result = runBaselineRules(
      buildData({
        licenses: [
          { state: 'CA', status: 'EXPIRED', expiryDate: new Date('2024-01-01T00:00:00Z'), disciplinaryFlag: true },
        ],
        deaCredentials: [{ status: 'EXPIRED', expiresAt: new Date('2024-01-01T00:00:00Z') }],
        boardCredentials: [{ status: 'LAPSED', expiresAt: new Date('2024-01-01T00:00:00Z') }],
        pecosEnrollments: [{ enrollmentType: 'CMS855I', status: 'DEACTIVATED' }],
        npdbFindings: [{ status: 'ADVERSE_ACTION' }],
        oppeCases: [{ status: 'FAILED', metrics: { complications: 5 } }],
        fppeSummary: { fppeStatus: 'FAILED', fppeEndDate: new Date('2024-01-01T00:00:00Z') },
      }),
      AS_OF
    );
    expect(result.score).toBe(100);
  });

  it('orders factors by severity weight', () => {
    const result = runBaselineRules(
      buildData({
        npdbFindings: [{ status: 'ADVERSE_ACTION' }],
        boardCredentials: [{ status: 'LAPSED', expiresAt: new Date('2024-01-01T00:00:00Z') }],
      }),
      AS_OF
    );
    expect(result.factors[0]).toBe(CredentialRiskFactors.NPDB_HIT);
    expect(result.factors[1]).toBe(CredentialRiskFactors.BOARD_EXPIRED);
  });

  it('populates detail messages for triggered factors', () => {
    const result = runBaselineRules(
      buildData({
        psvResult: { overallStatus: 'FAIL', sanctionFlag: true, licenseStatus: 'SUSPENDED' },
        licenses: [
          { state: 'CA', status: 'SUSPENDED', expiryDate: null, disciplinaryFlag: true },
        ],
      }),
      AS_OF
    );
    expect(Object.keys(result.details)).toContain(CredentialRiskFactors.SANCTION_FLAG);
    expect(result.details[CredentialRiskFactors.SANCTION_FLAG]).toMatch(/sanction/i);
  });
});

