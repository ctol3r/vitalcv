import {
  API_HARDENING_GATE_IDS,
  API_HARDENING_SENTINELS,
  buildApiHardeningLineage,
  evaluateApiHardeningGate,
  evaluateInstitutionalTrustApiHardening,
  runApiHardeningChaosSimulations,
  type ApiHardeningChaosScenarioName,
  type ApiRequestObservation,
} from '../institutionalTrustApiHardening';

const SURFACE_ID = 'surface-vitalcv-trust-api';
const GENERATED_AT = '2026-05-10T23:00:00.000Z';

function request(overrides: Partial<ApiRequestObservation> = {}): ApiRequestObservation {
  return {
    requestId: 'req-issuer-1',
    nonce: 'nonce-issuer-1',
    observedAt: '2026-05-10T20:00:00.000Z',
    callerOrgId: 'org-issuer-a',
    targetOrgId: 'org-issuer-a',
    routeFamily: 'ISSUER',
    routeId: 'issuer.credential.issue',
    method: 'POST',
    signatureValid: true,
    replayWindowExceededMs: 0,
    idempotentReplay: false,
    crossOrgGrantPresent: false,
    rateBudgetRemaining: 0.65,
    rateBudgetClass: 'trust-tier-gold',
    failedClosedOnExceedance: true,
    ambiguityFlag: null,
    responseLeakedCertainty: false,
    anomalyHint: null,
    lineageRefs: ['pre-issuer-1', 'credential-issuer-1'],
    evidenceRefs: ['psv-issuer-1', 'attestation-issuer-1'],
    latencyMs: 220,
    statusCode: 200,
    survivabilitySignal: 0.88,
    ...overrides,
  };
}

function baselineRequests(): ApiRequestObservation[] {
  return [
    request(),
    request({
      requestId: 'req-verifier-1',
      nonce: 'nonce-verifier-1',
      observedAt: '2026-05-10T20:04:00.000Z',
      callerOrgId: 'org-verifier-b',
      targetOrgId: 'org-issuer-a',
      routeFamily: 'VERIFIER',
      routeId: 'verifier.presentation.verify',
      crossOrgGrantPresent: true,
      ambiguityFlag: 'Verifier policy vocabulary reconciliation pending.',
      lineageRefs: ['acceptance-verifier-1', 'packet-verifier-1'],
      evidenceRefs: ['verifier-request-1', 'route-contract-1'],
      survivabilitySignal: 0.84,
    }),
    request({
      requestId: 'req-federation-1',
      nonce: 'nonce-federation-1',
      observedAt: '2026-05-10T20:08:00.000Z',
      callerOrgId: 'org-federation-c',
      targetOrgId: 'org-federation-c',
      routeFamily: 'FEDERATION',
      routeId: 'federation.metadata.get',
      method: 'GET',
      rateBudgetRemaining: 0.4,
      lineageRefs: ['federation-bundle-1'],
      evidenceRefs: ['federation-signature-1', 'trust-mark-1'],
      survivabilitySignal: 0.9,
    }),
    request({
      requestId: 'req-revocation-1',
      nonce: 'nonce-revocation-1',
      observedAt: '2026-05-10T20:12:00.000Z',
      callerOrgId: 'org-clinician-d',
      targetOrgId: 'org-clinician-d',
      routeFamily: 'REVOCATION',
      routeId: 'revocation.status.poll',
      method: 'GET',
      lineageRefs: ['status-list-1', 'revocation-anchor-1'],
      evidenceRefs: ['status-proof-1', 'status-window-1'],
      survivabilitySignal: 0.82,
    }),
  ];
}

describe('institutionalTrustApiHardening', () => {
  it('freezes the gate id surface and sentinel values', () => {
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
    expect(API_HARDENING_SENTINELS.failClosed).toBe(true);
  });

  it('passes hardened state when replay, cross-org, ambiguity, rate-limit, anomaly, and survivability hold', () => {
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests: baselineRequests(),
    });
    expect(result.failClosed).toBe(false);
    expect(result.status).toBe('HARDENED');
    expect(result.verdict).toBe('API_HARDENED');
    expect(result.replayHardening.enforced).toBe(true);
    expect(result.replayHardening.duplicateNonceCount).toBe(0);
    expect(result.crossOrgValidation.enforced).toBe(true);
    expect(result.crossOrgValidation.coveragePct).toBe(100);
    expect(result.ambiguityResponses.safe).toBe(true);
    expect(result.trustRateLimiting.failClosed).toBe(true);
    expect(result.anomalyDetection.status).toBe('CLEAR');
    expect(result.survivability.longitudinallyVisible).toBe(true);
    expect(result.ambiguityPreserved).toBe(true);
    expect(result.ambiguities).toContain('Verifier policy vocabulary reconciliation pending.');

    console.log(`[api-hardening-board] hardeningScore=${result.hardeningScore}`);
    console.log(`[api-hardening-board] replayIntegrityPct=${result.replayHardening.integrityPct}`);
    console.log(`[api-hardening-board] crossOrgCoveragePct=${result.crossOrgValidation.coveragePct}`);
    console.log(`[api-hardening-board] ambiguitySafePct=${result.ambiguityResponses.safePct}`);
    console.log(`[api-hardening-board] rateFailClosedPct=${result.trustRateLimiting.failClosedPct}`);
    console.log(`[api-hardening-board] survivabilityPct=${result.survivability.survivabilityPct}`);
  });

  it('fails closed when an API request fails signature or exceeds the replay window', () => {
    const requests = baselineRequests();
    requests[0] = { ...requests[0], signatureValid: false, replayWindowExceededMs: 120_000 };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.failClosed).toBe(true);
    expect(result.replayHardening.enforced).toBe(false);
    expect(result.replayHardening.unsafeRequestIds).toContain(requests[0].requestId);
    expect(result.blockers).toContain('API replay hardening is not enforced across the surface.');
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('api_replay_window_enforced');
    expect(gate.failedGateIds).toContain('fail_closed_api_semantics');
  });

  it('detects duplicate nonces as a replay-hardening failure', () => {
    const requests = baselineRequests();
    requests[1] = { ...requests[1], nonce: requests[0].nonce, idempotentReplay: true };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.replayHardening.duplicateNonceCount).toBeGreaterThan(0);
    expect(result.replayHardening.enforced).toBe(false);
  });

  it('fails closed when a cross-org request lacks an explicit grant', () => {
    const requests = baselineRequests();
    requests[1] = { ...requests[1], crossOrgGrantPresent: false };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.crossOrgValidation.enforced).toBe(false);
    expect(result.crossOrgValidation.invalidCrossOrgRequestIds).toContain(requests[1].requestId);
    expect(result.failClosed).toBe(true);
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('cross_org_validation_enforced');
  });

  it('fails closed when a response leaks certainty beyond evidence', () => {
    const requests = baselineRequests();
    requests[0] = { ...requests[0], responseLeakedCertainty: true };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.ambiguityResponses.safe).toBe(false);
    expect(result.ambiguityResponses.leakingRequestIds).toContain(requests[0].requestId);
    expect(result.failClosed).toBe(true);
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('ambiguity_safe_api_responses');
  });

  it('fails closed when an over-budget request is served instead of fail-closed', () => {
    const requests = baselineRequests();
    requests[2] = { ...requests[2], rateBudgetRemaining: 0, failedClosedOnExceedance: false };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.trustRateLimiting.failClosed).toBe(false);
    expect(result.trustRateLimiting.failOpenRequestIds).toContain(requests[2].requestId);
    expect(result.failClosed).toBe(true);
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('trust_rate_limiting_fail_closed');
  });

  it('marks the anomaly status as ANOMALY_LINEAGE_GAP when an anomalous request has no lineage', () => {
    const requests = baselineRequests();
    requests[3] = {
      ...requests[3],
      anomalyHint: 'unexpected status-list churn',
      lineageRefs: [],
      evidenceRefs: [],
    };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.anomalyDetection.status).toBe('ANOMALY_LINEAGE_GAP');
    expect(result.anomalyDetection.lineageReconstructable).toBe(false);
    expect(result.failClosed).toBe(true);
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('api_anomaly_lineage_reconstructable');
  });

  it('marks survivability as not visible when timestamps collapse to one point in time', () => {
    const requests = baselineRequests().map(r => ({ ...r, observedAt: '2026-05-10T20:00:00.000Z' }));
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.survivability.longitudinallyVisible).toBe(false);
    expect(result.failClosed).toBe(true);
    const gate = evaluateApiHardeningGate(result);
    expect(gate.failedGateIds).toContain('external_integration_survivability_visible');
  });

  it('produces a deterministic hardeningHash for identical input', () => {
    const requests = baselineRequests();
    const a = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    const b = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(a.hardeningHash).toEqual(b.hardeningHash);
    expect(a.lineage.lineageHash).toEqual(b.lineage.lineageHash);
  });

  it('produces a sorted, hash-bound lineage spanning each observed route family', () => {
    const lineage = buildApiHardeningLineage({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests: baselineRequests(),
    });
    expect(lineage.schema).toBe(API_HARDENING_SENTINELS.lineageSchema);
    expect(lineage.observedRouteFamilies).toEqual(['FEDERATION', 'ISSUER', 'REVOCATION', 'VERIFIER']);
    expect(lineage.firstObservedAt).toBe('2026-05-10T20:00:00.000Z');
    expect(lineage.lastObservedAt).toBe('2026-05-10T20:12:00.000Z');
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline).toHaveLength(4);
    for (const entry of lineage.timeline) {
      expect(entry.requestHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('runs all seven chaos scenarios and surfaces a signal on each', () => {
    const report = runApiHardeningChaosSimulations({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests: baselineRequests(),
    });
    expect(report.totalScenarios).toBe(7);
    expect(report.silentFailureCount).toBe(0);
    const observedScenarios = report.scenarios.map(s => s.scenario);
    const expectedScenarios: ApiHardeningChaosScenarioName[] = [
      'REPLAY_WINDOW_DRIFT',
      'NONCE_REUSE_FLOOD',
      'CROSS_ORG_LEAK',
      'AMBIGUITY_LOSS_IN_RESPONSE',
      'RATE_LIMIT_FAIL_OPEN',
      'ANOMALY_LINEAGE_GAP',
      'INTEGRATION_SURVIVABILITY_COLLAPSE',
    ];
    for (const scenario of expectedScenarios) {
      expect(observedScenarios).toContain(scenario);
    }
    for (const scenario of report.scenarios) {
      expect(scenario.signalSurfaced).toBe(true);
    }
    expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/);

    console.log(`[api-hardening-board] chaosScenarios=${report.totalScenarios}`);
    console.log(`[api-hardening-board] chaosSilentFailures=${report.silentFailureCount}`);
  });

  it('preserves a sorted, deduplicated set of ambiguities across the surface', () => {
    const requests = baselineRequests();
    requests[2] = { ...requests[2], ambiguityFlag: 'Verifier policy vocabulary reconciliation pending.' };
    requests[3] = { ...requests[3], ambiguityFlag: 'Status-list refresh window pending operator review.' };
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.ambiguityPreserved).toBe(true);
    expect(result.ambiguities).toEqual([
      'Verifier policy vocabulary reconciliation pending.',
      'Status-list refresh window pending operator review.',
    ]);
  });

  it('clamps hardening score to <=49 when blockers are present', () => {
    const requests = baselineRequests().map(r => ({ ...r, signatureValid: false, responseLeakedCertainty: true }));
    const result = evaluateInstitutionalTrustApiHardening({
      surfaceId: SURFACE_ID,
      generatedAt: GENERATED_AT,
      requests,
    });
    expect(result.failClosed).toBe(true);
    expect(result.hardeningScore).toBeLessThanOrEqual(49);
    expect(result.verdict).toBe('API_BLOCKED');
  });
});
