import {
  WALLET_INTEROPERABILITY_CI_GATES,
  buildWalletInteroperabilityManifest,
  createWalletReplayFingerprint,
  evaluateWalletInteroperability,
  runWalletInteroperabilityChaos,
  type WalletInteroperabilityFlow,
} from '../../../packages/wallet-sdk/src/index';

const generatedAt = '2026-05-11T10:00:00.000Z';

function makeFlow(overrides: Partial<WalletInteroperabilityFlow> = {}): WalletInteroperabilityFlow {
  const flow: WalletInteroperabilityFlow = {
    flowId: 'wallet-flow-a',
    institutionId: 'hospital-a',
    credentialId: 'cred-ca-md-1',
    subjectNpi: '1234567890',
    holderDid: 'did:vitalcv:holder-1234567890',
    issuerDid: 'did:vitalcv:issuer-ca-board',
    verifierDid: 'did:vitalcv:verifier-hospital-a',
    format: 'sd-jwt-vc',
    sdJwt: {
      verified: true,
      signatureVerified: true,
      keyBindingVerified: true,
      issuerTrusted: true,
      alg: 'ES256',
      disclosureDigests: ['sha256:license', 'sha256:npi'],
      disclosedClaims: ['licenseNumber', 'npi'],
      withheldClaims: ['dateOfBirth'],
    },
    openid4vp: {
      requestValidated: true,
      presentationDefinitionId: 'pd-vitalcv-clinician-v1',
      responseMode: 'direct_post.jwt',
      nonce: 'nonce-wallet-a',
      state: 'state-wallet-a',
      vpTokenPresent: true,
      audienceVerified: true,
    },
    replay: {
      replayTraceId: 'replay-wallet-a',
      challenge: 'challenge-wallet-a',
      nonce: 'nonce-wallet-a',
      createdAt: '2026-05-11T10:01:00.000Z',
      expiresAt: '2026-05-11T10:06:00.000Z',
      deterministicFingerprint: 'fingerprint-wallet-a',
    },
    portability: {
      schemaId: 'vitalcv.clinician-credential.v1',
      canonicalClaimDigest: 'sha256:canonical-claims-a',
      revocationRef: 'revocation:cred-ca-md-1',
      adapterVersion: 'wallet-adapter-v1',
      crossInstitutionProfiles: ['hospital-a', 'hospital-b'],
    },
    ambiguity: {
      state: 'none',
      preserved: true,
      refs: [],
      note: null,
    },
    continuity: {
      observedAt: '2026-05-11T10:01:00.000Z',
      telemetryRef: 'telemetry-wallet-a',
      lineageRef: 'lineage-wallet-a',
      survivabilityRef: 'survivability-wallet-a',
    },
    failClosed: true,
  };

  return {
    ...flow,
    ...overrides,
    sdJwt: { ...flow.sdJwt, ...overrides.sdJwt },
    openid4vp: { ...flow.openid4vp, ...overrides.openid4vp },
    replay: { ...flow.replay, ...overrides.replay },
    portability: { ...flow.portability, ...overrides.portability },
    ambiguity: { ...flow.ambiguity, ...overrides.ambiguity },
    continuity: { ...flow.continuity, ...overrides.continuity },
  };
}

function baselineFlows(): WalletInteroperabilityFlow[] {
  return [
    makeFlow(),
    makeFlow({
      flowId: 'wallet-flow-b',
      institutionId: 'hospital-b',
      credentialId: 'cred-pecos-2',
      issuerDid: 'did:vitalcv:issuer-cms-pecos',
      verifierDid: 'did:vitalcv:verifier-hospital-b',
      sdJwt: {
        disclosureDigests: ['sha256:pecos', 'sha256:npi'],
        disclosedClaims: ['pecosEnrollment', 'npi'],
        withheldClaims: ['internalSourceTrace'],
      },
      openid4vp: {
        nonce: 'nonce-wallet-b',
        state: 'state-wallet-b',
      },
      replay: {
        replayTraceId: 'replay-wallet-b',
        challenge: 'challenge-wallet-b',
        nonce: 'nonce-wallet-b',
        createdAt: '2026-05-11T10:02:00.000Z',
        expiresAt: '2026-05-11T10:07:00.000Z',
        deterministicFingerprint: 'fingerprint-wallet-b',
      },
      portability: {
        canonicalClaimDigest: 'sha256:canonical-claims-b',
        revocationRef: 'revocation:cred-pecos-2',
        crossInstitutionProfiles: ['hospital-a', 'hospital-b', 'staffing-c'],
      },
      ambiguity: {
        state: 'source_gated',
        preserved: true,
        refs: ['coverage:pecos:quarterly-snapshot'],
        note: 'PECOS is source-backed by quarterly snapshot, not a real-time clearance.',
      },
      continuity: {
        observedAt: '2026-05-11T10:02:00.000Z',
        telemetryRef: 'telemetry-wallet-b',
        lineageRef: 'lineage-wallet-b',
        survivabilityRef: 'survivability-wallet-b',
      },
    }),
  ];
}

describe('W3-PR180A wallet interoperability final push', () => {
  it('builds deterministic wallet manifests independent of input order', () => {
    const flows = baselineFlows();
    const forward = buildWalletInteroperabilityManifest({
      manifestId: 'wallet-interop-180a',
      generatedAt,
      flows,
    });
    const reversed = buildWalletInteroperabilityManifest({
      manifestId: 'wallet-interop-180a',
      generatedAt,
      flows: [...flows].reverse(),
    });

    expect(forward.schema).toBe('vitalcv.wallet-interoperability.v1');
    expect(forward.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(forward.manifestHash).toBe(reversed.manifestHash);
    expect(forward.flows.map((flow) => flow.flowId)).toEqual(['wallet-flow-a', 'wallet-flow-b']);
    expect(forward.interopContract.failClosedSemantics).toBe(true);
    expect(forward.interopContract.ambiguityPreserved).toBe(true);
  });

  it('scores SD-JWT, OpenID4VP, replay, portability, and continuity while preserving ambiguity', () => {
    const manifest = buildWalletInteroperabilityManifest({
      manifestId: 'wallet-interop-180a',
      generatedAt,
      flows: baselineFlows(),
    });

    const result = evaluateWalletInteroperability(manifest);

    expect(result.status).toBe('WALLET_INTEROPERABLE_WITH_AMBIGUITY');
    expect(result.verdict).toBe('WALLET_INTEROPERABILITY_READY_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.ambiguities).toEqual([
      'wallet-flow-b: PECOS is source-backed by quarterly snapshot, not a real-time clearance.',
    ]);
    expect(result.scores.sdJwtFidelityPct).toBe(100);
    expect(result.scores.openid4vpCompatibilityPct).toBe(100);
    expect(result.scores.replayWalletIntegrityPct).toBe(100);
    expect(result.scores.credentialPortabilityPct).toBe(100);
    expect(result.scores.walletInteroperabilityMaturityPct).toBeGreaterThanOrEqual(95);
    expect(result.gateResults.map((gate) => gate.gateId)).toEqual(WALLET_INTEROPERABILITY_CI_GATES);
    expect(result.gateResults.every((gate) => gate.pass)).toBe(true);
  });

  it('fails closed when wallet interoperability evidence loses determinism or trust boundaries', () => {
    const broken = makeFlow({
      sdJwt: {
        verified: false,
        signatureVerified: false,
        keyBindingVerified: false,
        issuerTrusted: false,
        alg: 'none',
        disclosureDigests: [],
      },
      openid4vp: {
        requestValidated: false,
        presentationDefinitionId: null,
        responseMode: 'fragment',
        nonce: null,
        state: null,
        vpTokenPresent: false,
        audienceVerified: false,
      },
      replay: {
        replayTraceId: null,
        challenge: null,
        nonce: null,
        createdAt: '2026-05-11T10:01:00.000Z',
        expiresAt: '2026-05-11T10:01:00.000Z',
        deterministicFingerprint: null,
      },
      portability: {
        schemaId: null,
        canonicalClaimDigest: null,
        revocationRef: null,
        adapterVersion: null,
        crossInstitutionProfiles: ['hospital-a'],
      },
      ambiguity: {
        state: 'source_gated',
        preserved: false,
        refs: [],
        note: null,
      },
      continuity: {
        telemetryRef: null,
        lineageRef: null,
        survivabilityRef: null,
      },
      failClosed: false,
    });

    const result = evaluateWalletInteroperability(
      buildWalletInteroperabilityManifest({
        manifestId: 'wallet-interop-180a',
        generatedAt,
        flows: [broken],
      }),
    );

    expect(result.status).toBe('WALLET_BLOCKED');
    expect(result.verdict).toBe('WALLET_INTEROPERABILITY_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual([
      'SD-JWT verification is not harmonized.',
      'OpenID4VP interoperability checks are incomplete.',
      'Wallet replay validation is not safe.',
      'Credential portability is not deterministic.',
      'Ambiguity was flattened in wallet interoperability evidence.',
      'Wallet semantics are not fail-closed.',
      'Wallet interoperability is not measurable.',
      'Wallet continuity is not longitudinally durable.',
    ]);
  });

  it('detects wallet chaos scenarios as CI-gate failures', () => {
    const report = runWalletInteroperabilityChaos(baselineFlows(), generatedAt);

    expect(report.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      'SD_JWT_SIGNATURE_GAP',
      'OID4VP_NONCE_DROP',
      'REPLAY_NONCE_REUSE',
      'PORTABILITY_DIGEST_DRIFT',
      'AMBIGUITY_FLATTENED',
      'FAIL_OPEN_WALLET',
      'CONTINUITY_TELEMETRY_DROP',
    ]);
    expect(report.scenarios.every((scenario) => scenario.blocked)).toBe(true);
    expect(report.survivabilityPct).toBe(100);
  });

  it('fails closed instead of throwing when chaos simulation has no wallet evidence', () => {
    const report = runWalletInteroperabilityChaos([], generatedAt);

    expect(report.scenarios).toHaveLength(7);
    expect(report.scenarios.every((scenario) => scenario.blocked)).toBe(true);
    expect(report.scenarios.every((scenario) => scenario.verdict === 'WALLET_INTEROPERABILITY_FAIL_CLOSED')).toBe(true);
    expect(report.survivabilityPct).toBe(100);
  });

  it('derives a stable replay fingerprint from portable wallet evidence', () => {
    const flow = makeFlow({
      sdJwt: {
        disclosureDigests: ['sha256:npi', 'sha256:license'],
      },
      portability: {
        crossInstitutionProfiles: ['hospital-b', 'hospital-a'],
      },
    });
    const reordered = makeFlow({
      sdJwt: {
        disclosureDigests: ['sha256:license', 'sha256:npi'],
      },
      portability: {
        crossInstitutionProfiles: ['hospital-a', 'hospital-b'],
      },
    });

    expect(createWalletReplayFingerprint(flow)).toMatch(/^[a-f0-9]{64}$/);
    expect(createWalletReplayFingerprint(flow)).toBe(createWalletReplayFingerprint(reordered));
  });
});
