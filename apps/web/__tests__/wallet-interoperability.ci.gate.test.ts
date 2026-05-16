import {
  WALLET_INTEROPERABILITY_CI_GATES,
  WALLET_INTEROPERABILITY_SENTINELS,
  buildWalletInteroperabilityManifest,
  evaluateWalletInteroperability,
  evaluateWalletInteroperabilityGate,
  type WalletInteroperabilityFlow,
} from '../../../packages/wallet-sdk/src/index';

const gateFlow: WalletInteroperabilityFlow = {
  flowId: 'ci-wallet-flow',
  institutionId: 'hospital-ci',
  credentialId: 'cred-ci',
  subjectNpi: '1234567890',
  holderDid: 'did:vitalcv:holder-ci',
  issuerDid: 'did:vitalcv:issuer-ci',
  verifierDid: 'did:vitalcv:verifier-ci',
  format: 'sd-jwt-vc',
  sdJwt: {
    verified: true,
    signatureVerified: true,
    keyBindingVerified: true,
    issuerTrusted: true,
    alg: 'ES256',
    disclosureDigests: ['sha256:ci'],
    disclosedClaims: ['npi'],
    withheldClaims: ['dateOfBirth'],
  },
  openid4vp: {
    requestValidated: true,
    presentationDefinitionId: 'pd-ci',
    responseMode: 'direct_post.jwt',
    nonce: 'nonce-ci',
    state: 'state-ci',
    vpTokenPresent: true,
    audienceVerified: true,
  },
  replay: {
    replayTraceId: 'replay-ci',
    challenge: 'challenge-ci',
    nonce: 'nonce-ci',
    createdAt: '2026-05-11T10:00:00.000Z',
    expiresAt: '2026-05-11T10:05:00.000Z',
    deterministicFingerprint: 'fingerprint-ci',
  },
  portability: {
    schemaId: 'vitalcv.clinician-credential.v1',
    canonicalClaimDigest: 'sha256:ci-claims',
    revocationRef: 'revocation:cred-ci',
    adapterVersion: 'wallet-adapter-v1',
    crossInstitutionProfiles: ['hospital-ci', 'hospital-peer'],
  },
  ambiguity: {
    state: 'none',
    preserved: true,
    refs: [],
    note: null,
  },
  continuity: {
    observedAt: '2026-05-11T10:00:00.000Z',
    telemetryRef: 'telemetry-ci',
    lineageRef: 'lineage-ci',
    survivabilityRef: 'survivability-ci',
  },
  failClosed: true,
};

describe('W3-PR180A wallet interoperability CI gates', () => {
  it('pins the wallet interoperability gate list and sentinels', () => {
    expect(WALLET_INTEROPERABILITY_CI_GATES).toEqual([
      'sd_jwt_verification_harmonized',
      'openid4vp_interoperability_checked',
      'wallet_replay_safe',
      'credential_portability_deterministic',
      'ambiguity_preserved_operationally',
      'fail_closed_wallet_semantics',
      'interoperability_measurable',
      'wallet_continuity_longitudinally_durable',
    ]);
    expect(WALLET_INTEROPERABILITY_SENTINELS).toEqual({
      schema: 'vitalcv.wallet-interoperability.v1',
      failClosedVerdict: 'WALLET_INTEROPERABILITY_FAIL_CLOSED',
      readyVerdict: 'WALLET_INTEROPERABILITY_READY',
      ambiguityVerdict: 'WALLET_INTEROPERABILITY_READY_WITH_AMBIGUITY',
    });
  });

  it('passes all gates for deterministic replay-safe wallet evidence', () => {
    const result = evaluateWalletInteroperability(
      buildWalletInteroperabilityManifest({
        manifestId: 'wallet-ci',
        generatedAt: '2026-05-11T10:00:00.000Z',
        flows: [gateFlow],
      }),
    );

    expect(result.status).toBe('WALLET_INTEROPERABLE');
    expect(result.verdict).toBe('WALLET_INTEROPERABILITY_READY');
    expect(result.gateResults.every((gate) => gate.pass)).toBe(true);
  });

  it('exposes per-gate fail-closed decisions for CI consumers', () => {
    const result = evaluateWalletInteroperability(
      buildWalletInteroperabilityManifest({
        manifestId: 'wallet-ci',
        generatedAt: '2026-05-11T10:00:00.000Z',
        flows: [
          {
            ...gateFlow,
            failClosed: false,
            replay: {
              ...gateFlow.replay,
              deterministicFingerprint: null,
            },
          },
        ],
      }),
    );

    expect(evaluateWalletInteroperabilityGate(result, 'wallet_replay_safe')).toEqual({
      gateId: 'wallet_replay_safe',
      pass: false,
      blocker: 'Wallet replay validation is not safe.',
    });
    expect(evaluateWalletInteroperabilityGate(result, 'fail_closed_wallet_semantics')).toEqual({
      gateId: 'fail_closed_wallet_semantics',
      pass: false,
      blocker: 'Wallet semantics are not fail-closed.',
    });
  });
});
