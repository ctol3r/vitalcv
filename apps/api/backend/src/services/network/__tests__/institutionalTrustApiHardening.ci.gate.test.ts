import {
  API_HARDENING_GATE_IDS,
  API_HARDENING_SENTINELS,
  evaluateApiHardeningGate,
  evaluateInstitutionalTrustApiHardening,
  runApiHardeningChaosSimulations,
  type ApiRequestObservation,
} from '../institutionalTrustApiHardening';

const SURFACE_ID = 'ci-surface-trust-api';
const GENERATED_AT = '2026-05-10T23:00:00.000Z';

const requests: ApiRequestObservation[] = [
  {
    requestId: 'ci-req-issuer',
    nonce: 'ci-nonce-issuer',
    observedAt: '2026-05-10T20:00:00.000Z',
    callerOrgId: 'org-issuer-ci',
    targetOrgId: 'org-issuer-ci',
    routeFamily: 'ISSUER',
    routeId: 'issuer.credential.issue',
    method: 'POST',
    signatureValid: true,
    replayWindowExceededMs: 0,
    idempotentReplay: false,
    crossOrgGrantPresent: false,
    rateBudgetRemaining: 0.71,
    rateBudgetClass: 'trust-tier-ci',
    failedClosedOnExceedance: true,
    ambiguityFlag: null,
    responseLeakedCertainty: false,
    anomalyHint: null,
    lineageRefs: ['pre-ci', 'credential-ci'],
    evidenceRefs: ['psv-ci', 'attestation-ci'],
    latencyMs: 210,
    statusCode: 200,
    survivabilitySignal: 0.9,
  },
  {
    requestId: 'ci-req-verifier',
    nonce: 'ci-nonce-verifier',
    observedAt: '2026-05-10T20:04:00.000Z',
    callerOrgId: 'org-verifier-ci',
    targetOrgId: 'org-issuer-ci',
    routeFamily: 'VERIFIER',
    routeId: 'verifier.presentation.verify',
    method: 'POST',
    signatureValid: true,
    replayWindowExceededMs: 0,
    idempotentReplay: false,
    crossOrgGrantPresent: true,
    rateBudgetRemaining: 0.55,
    rateBudgetClass: 'trust-tier-ci',
    failedClosedOnExceedance: true,
    ambiguityFlag: 'Verifier policy vocabulary reconciliation pending.',
    responseLeakedCertainty: false,
    anomalyHint: null,
    lineageRefs: ['acceptance-ci', 'packet-ci'],
    evidenceRefs: ['verifier-request-ci', 'route-contract-ci'],
    latencyMs: 280,
    statusCode: 200,
    survivabilitySignal: 0.85,
  },
  {
    requestId: 'ci-req-federation',
    nonce: 'ci-nonce-federation',
    observedAt: '2026-05-10T20:08:00.000Z',
    callerOrgId: 'org-federation-ci',
    targetOrgId: 'org-federation-ci',
    routeFamily: 'FEDERATION',
    routeId: 'federation.metadata.get',
    method: 'GET',
    signatureValid: true,
    replayWindowExceededMs: 0,
    idempotentReplay: false,
    crossOrgGrantPresent: false,
    rateBudgetRemaining: 0.6,
    rateBudgetClass: 'trust-tier-ci',
    failedClosedOnExceedance: true,
    ambiguityFlag: null,
    responseLeakedCertainty: false,
    anomalyHint: null,
    lineageRefs: ['federation-bundle-ci'],
    evidenceRefs: ['federation-signature-ci', 'trust-mark-ci'],
    latencyMs: 160,
    statusCode: 200,
    survivabilitySignal: 0.92,
  },
  {
    requestId: 'ci-req-revocation',
    nonce: 'ci-nonce-revocation',
    observedAt: '2026-05-10T20:12:00.000Z',
    callerOrgId: 'org-clinician-ci',
    targetOrgId: 'org-clinician-ci',
    routeFamily: 'REVOCATION',
    routeId: 'revocation.status.poll',
    method: 'GET',
    signatureValid: true,
    replayWindowExceededMs: 0,
    idempotentReplay: false,
    crossOrgGrantPresent: false,
    rateBudgetRemaining: 0.78,
    rateBudgetClass: 'trust-tier-ci',
    failedClosedOnExceedance: true,
    ambiguityFlag: null,
    responseLeakedCertainty: false,
    anomalyHint: null,
    lineageRefs: ['status-list-ci', 'revocation-anchor-ci'],
    evidenceRefs: ['status-proof-ci', 'status-window-ci'],
    latencyMs: 140,
    statusCode: 200,
    survivabilitySignal: 0.86,
  },
];

describe('CI gate - institutional trust API hardening', () => {
  it('keeps the gate id surface explicit and frozen', () => {
    expect(API_HARDENING_GATE_IDS).toEqual([
      'api_replay_window_enforced',
      'cross_org_validation_enforced',
      'ambiguity_safe_api_responses',
      'trust_rate_limiting_fail_closed',
      'api_anomaly_lineage_reconstructable',
      'external_integration_survivability_visible',
      'fail_closed_api_semantics',
    ]);
    expect(Object.isFrozen(API_HARDENING_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(API_HARDENING_SENTINELS)).toBe(true);
  });

  it('passes only when replay, cross-org, ambiguity, rate-limit, anomaly, survivability, and fail-closed semantics hold together', () => {
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    const gate = evaluateApiHardeningGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map(g => g.id)).toEqual(API_HARDENING_GATE_IDS);

    console.log(`[api-hardening-board] gatePass=${gate.pass}`);
    console.log(`[api-hardening-board] hardeningScore=${result.hardeningScore}`);
    console.log(`[api-hardening-board] verdict=${result.verdict}`);
  });

  it('surfaces a signal for every chaos scenario at the CI gate', () => {
    const report = runApiHardeningChaosSimulations({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(report.totalScenarios).toBe(7);
    expect(report.silentFailureCount).toBe(0);
    for (const scenario of report.scenarios) {
      expect(scenario.signalSurfaced).toBe(true);
    }

    console.log(`[api-hardening-board] chaosScenarios=${report.totalScenarios}`);
    console.log(`[api-hardening-board] chaosSilentFailures=${report.silentFailureCount}`);
  });
});
