export type WalletCredentialFormat = 'sd-jwt-vc' | 'vp-jwt' | 'w3c-vc-jwt' | 'mobile-offline-envelope';
export type WalletAmbiguityState = 'none' | 'withheld_claims' | 'source_gated' | 'conflict' | 'expired' | 'manual_review';
export type WalletInteropStatus = 'WALLET_INTEROPERABLE' | 'WALLET_INTEROPERABLE_WITH_AMBIGUITY' | 'WALLET_BLOCKED';
export type WalletInteropVerdict =
  | 'WALLET_INTEROPERABILITY_READY'
  | 'WALLET_INTEROPERABILITY_READY_WITH_AMBIGUITY'
  | 'WALLET_INTEROPERABILITY_FAIL_CLOSED';

export type WalletInteroperabilityGateId =
  | 'sd_jwt_verification_harmonized'
  | 'openid4vp_interoperability_checked'
  | 'wallet_replay_safe'
  | 'credential_portability_deterministic'
  | 'ambiguity_preserved_operationally'
  | 'fail_closed_wallet_semantics'
  | 'interoperability_measurable'
  | 'wallet_continuity_longitudinally_durable';

export interface WalletSdJwtEvidence {
  verified: boolean;
  signatureVerified: boolean;
  keyBindingVerified: boolean;
  issuerTrusted: boolean;
  alg: string;
  disclosureDigests: string[];
  disclosedClaims: string[];
  withheldClaims: string[];
}

export interface WalletOpenId4VpEvidence {
  requestValidated: boolean;
  presentationDefinitionId: string | null;
  responseMode: string;
  nonce: string | null;
  state: string | null;
  vpTokenPresent: boolean;
  audienceVerified: boolean;
}

export interface WalletReplayEvidence {
  replayTraceId: string | null;
  challenge: string | null;
  nonce: string | null;
  createdAt: string;
  expiresAt: string;
  deterministicFingerprint: string | null;
}

export interface WalletPortabilityEvidence {
  schemaId: string | null;
  canonicalClaimDigest: string | null;
  revocationRef: string | null;
  adapterVersion: string | null;
  crossInstitutionProfiles: string[];
}

export interface WalletAmbiguityEvidence {
  state: WalletAmbiguityState;
  preserved: boolean;
  refs: string[];
  note: string | null;
}

export interface WalletContinuityEvidence {
  observedAt: string;
  telemetryRef: string | null;
  lineageRef: string | null;
  survivabilityRef: string | null;
}

export interface WalletInteroperabilityFlow {
  flowId: string;
  institutionId: string;
  credentialId: string;
  subjectNpi: string;
  holderDid: string;
  issuerDid: string;
  verifierDid: string;
  format: WalletCredentialFormat;
  sdJwt: WalletSdJwtEvidence;
  openid4vp: WalletOpenId4VpEvidence;
  replay: WalletReplayEvidence;
  portability: WalletPortabilityEvidence;
  ambiguity: WalletAmbiguityEvidence;
  continuity: WalletContinuityEvidence;
  failClosed: boolean;
}

export interface WalletInteroperabilityManifest {
  schema: 'vitalcv.wallet-interoperability.v1';
  manifestId: string;
  generatedAt: string;
  manifestHash: string;
  flows: WalletInteroperabilityFlow[];
  interopContract: {
    deterministic: boolean;
    replaySafe: boolean;
    failClosedSemantics: boolean;
    ambiguityPreserved: boolean;
    credentialPortabilityDeterministic: boolean;
    interoperabilityMeasurable: boolean;
    longitudinalContinuityDurable: boolean;
  };
}

export interface WalletInteroperabilityScores {
  sdJwtFidelityPct: number;
  openid4vpCompatibilityPct: number;
  replayWalletIntegrityPct: number;
  credentialPortabilityPct: number;
  walletContinuityPct: number;
  walletInteroperabilityMaturityPct: number;
}

export interface WalletInteroperabilityGateResult {
  gateId: WalletInteroperabilityGateId;
  pass: boolean;
  blocker: string | null;
}

export interface WalletInteroperabilityResult {
  schema: 'vitalcv.wallet-interoperability.v1';
  manifestId: string;
  manifestHash: string;
  status: WalletInteropStatus;
  verdict: WalletInteropVerdict;
  failClosed: boolean;
  scores: WalletInteroperabilityScores;
  blockers: string[];
  ambiguities: string[];
  gateResults: WalletInteroperabilityGateResult[];
}

export interface WalletInteroperabilityChaosScenario {
  scenarioId:
    | 'SD_JWT_SIGNATURE_GAP'
    | 'OID4VP_NONCE_DROP'
    | 'REPLAY_NONCE_REUSE'
    | 'PORTABILITY_DIGEST_DRIFT'
    | 'AMBIGUITY_FLATTENED'
    | 'FAIL_OPEN_WALLET'
    | 'CONTINUITY_TELEMETRY_DROP';
  blocked: boolean;
  failedGates: WalletInteroperabilityGateId[];
  verdict: WalletInteropVerdict;
}

export interface WalletInteroperabilityChaosReport {
  schema: 'vitalcv.wallet-interoperability-chaos.v1';
  generatedAt: string;
  scenarios: WalletInteroperabilityChaosScenario[];
  survivabilityPct: number;
}

export const WALLET_INTEROPERABILITY_CI_GATES: WalletInteroperabilityGateId[] = [
  'sd_jwt_verification_harmonized',
  'openid4vp_interoperability_checked',
  'wallet_replay_safe',
  'credential_portability_deterministic',
  'ambiguity_preserved_operationally',
  'fail_closed_wallet_semantics',
  'interoperability_measurable',
  'wallet_continuity_longitudinally_durable',
];

export const WALLET_INTEROPERABILITY_SENTINELS = {
  schema: 'vitalcv.wallet-interoperability.v1',
  failClosedVerdict: 'WALLET_INTEROPERABILITY_FAIL_CLOSED',
  readyVerdict: 'WALLET_INTEROPERABILITY_READY',
  ambiguityVerdict: 'WALLET_INTEROPERABILITY_READY_WITH_AMBIGUITY',
} as const;

const ALLOWED_SD_JWT_ALGS = new Set(['ES256', 'ES384', 'EdDSA']);
const ALLOWED_RESPONSE_MODES = new Set(['direct_post', 'direct_post.jwt']);
const PORTABLE_FORMATS = new Set<WalletCredentialFormat>(['sd-jwt-vc', 'vp-jwt', 'w3c-vc-jwt']);

const BLOCKERS: Record<WalletInteroperabilityGateId, string> = {
  sd_jwt_verification_harmonized: 'SD-JWT verification is not harmonized.',
  openid4vp_interoperability_checked: 'OpenID4VP interoperability checks are incomplete.',
  wallet_replay_safe: 'Wallet replay validation is not safe.',
  credential_portability_deterministic: 'Credential portability is not deterministic.',
  ambiguity_preserved_operationally: 'Ambiguity was flattened in wallet interoperability evidence.',
  fail_closed_wallet_semantics: 'Wallet semantics are not fail-closed.',
  interoperability_measurable: 'Wallet interoperability is not measurable.',
  wallet_continuity_longitudinally_durable: 'Wallet continuity is not longitudinally durable.',
};

export function buildWalletInteroperabilityManifest(input: {
  manifestId: string;
  generatedAt: string;
  flows: WalletInteroperabilityFlow[];
}): WalletInteroperabilityManifest {
  const flows = [...input.flows].sort(compareFlows);
  const duplicateReplayNonces = findDuplicateReplayNonces(flows);
  const interopContract = {
    deterministic: flows.every(isFlowDeterministic),
    replaySafe: flows.every((flow) => isReplaySafe(flow, duplicateReplayNonces)),
    failClosedSemantics: flows.every((flow) => flow.failClosed),
    ambiguityPreserved: flows.every(isAmbiguityPreserved),
    credentialPortabilityDeterministic: flows.every(isCredentialPortable),
    interoperabilityMeasurable: flows.length > 0 && flows.every(isInteroperabilityMeasurable),
    longitudinalContinuityDurable: flows.length > 0 && flows.every(isContinuityDurable),
  };

  const manifestHash = stableHash({
    schema: WALLET_INTEROPERABILITY_SENTINELS.schema,
    manifestId: input.manifestId,
    generatedAt: input.generatedAt,
    flows: flows.map(normalizeFlow),
    interopContract,
  });

  return {
    schema: WALLET_INTEROPERABILITY_SENTINELS.schema,
    manifestId: input.manifestId,
    generatedAt: input.generatedAt,
    manifestHash,
    flows,
    interopContract,
  };
}

export function evaluateWalletInteroperability(manifest: WalletInteroperabilityManifest): WalletInteroperabilityResult {
  const flows = manifest.flows;
  const duplicateReplayNonces = findDuplicateReplayNonces(flows);
  const scores = buildScores(flows, duplicateReplayNonces);
  const failedGates = new Set<WalletInteroperabilityGateId>();

  if (!flows.length || scores.sdJwtFidelityPct < 100) failedGates.add('sd_jwt_verification_harmonized');
  if (!flows.length || scores.openid4vpCompatibilityPct < 100) failedGates.add('openid4vp_interoperability_checked');
  if (!flows.length || scores.replayWalletIntegrityPct < 100) failedGates.add('wallet_replay_safe');
  if (!flows.length || scores.credentialPortabilityPct < 100) failedGates.add('credential_portability_deterministic');
  if (!flows.every(isAmbiguityPreserved)) failedGates.add('ambiguity_preserved_operationally');
  if (!flows.length || !flows.every((flow) => flow.failClosed)) failedGates.add('fail_closed_wallet_semantics');
  if (!flows.length || !flows.every(isInteroperabilityMeasurable)) failedGates.add('interoperability_measurable');
  if (!flows.length || !flows.every(isContinuityDurable)) failedGates.add('wallet_continuity_longitudinally_durable');

  const gateResults = WALLET_INTEROPERABILITY_CI_GATES.map((gateId) => ({
    gateId,
    pass: !failedGates.has(gateId),
    blocker: failedGates.has(gateId) ? BLOCKERS[gateId] : null,
  }));
  const blockers = gateResults
    .filter((gate) => !gate.pass)
    .map((gate) => gate.blocker)
    .filter((blocker): blocker is string => Boolean(blocker));
  const ambiguities = flows
    .filter((flow) => flow.ambiguity.state !== 'none')
    .map((flow) => `${flow.flowId}: ${flow.ambiguity.note ?? flow.ambiguity.state}`);
  const status: WalletInteropStatus = blockers.length
    ? 'WALLET_BLOCKED'
    : ambiguities.length
      ? 'WALLET_INTEROPERABLE_WITH_AMBIGUITY'
      : 'WALLET_INTEROPERABLE';
  const verdict: WalletInteropVerdict = status === 'WALLET_BLOCKED'
    ? 'WALLET_INTEROPERABILITY_FAIL_CLOSED'
    : status === 'WALLET_INTEROPERABLE_WITH_AMBIGUITY'
      ? 'WALLET_INTEROPERABILITY_READY_WITH_AMBIGUITY'
      : 'WALLET_INTEROPERABILITY_READY';

  return {
    schema: WALLET_INTEROPERABILITY_SENTINELS.schema,
    manifestId: manifest.manifestId,
    manifestHash: manifest.manifestHash,
    status,
    verdict,
    failClosed: blockers.length > 0,
    scores,
    blockers,
    ambiguities,
    gateResults,
  };
}

export function evaluateWalletInteroperabilityGate(
  result: WalletInteroperabilityResult,
  gateId: WalletInteroperabilityGateId,
): WalletInteroperabilityGateResult {
  return result.gateResults.find((gate) => gate.gateId === gateId) ?? {
    gateId,
    pass: false,
    blocker: BLOCKERS[gateId],
  };
}

export function createWalletReplayFingerprint(flow: WalletInteroperabilityFlow): string {
  return stableHash({
    flowId: flow.flowId,
    institutionId: flow.institutionId,
    credentialId: flow.credentialId,
    subjectNpi: flow.subjectNpi,
    holderDid: flow.holderDid,
    issuerDid: flow.issuerDid,
    verifierDid: flow.verifierDid,
    format: flow.format,
    sdJwt: {
      alg: flow.sdJwt.alg,
      disclosureDigests: [...flow.sdJwt.disclosureDigests].sort(),
      disclosedClaims: [...flow.sdJwt.disclosedClaims].sort(),
      withheldClaims: [...flow.sdJwt.withheldClaims].sort(),
    },
    openid4vp: {
      presentationDefinitionId: flow.openid4vp.presentationDefinitionId,
      responseMode: flow.openid4vp.responseMode,
      nonce: flow.openid4vp.nonce,
      state: flow.openid4vp.state,
    },
    replay: {
      replayTraceId: flow.replay.replayTraceId,
      challenge: flow.replay.challenge,
      nonce: flow.replay.nonce,
      createdAt: flow.replay.createdAt,
      expiresAt: flow.replay.expiresAt,
    },
    portability: {
      schemaId: flow.portability.schemaId,
      canonicalClaimDigest: flow.portability.canonicalClaimDigest,
      revocationRef: flow.portability.revocationRef,
      adapterVersion: flow.portability.adapterVersion,
      crossInstitutionProfiles: [...flow.portability.crossInstitutionProfiles].sort(),
    },
    ambiguity: {
      state: flow.ambiguity.state,
      refs: [...flow.ambiguity.refs].sort(),
    },
  });
}

export function runWalletInteroperabilityChaos(
  flows: WalletInteroperabilityFlow[],
  generatedAt: string,
): WalletInteroperabilityChaosReport {
  const scenarioDefs: Array<{
    scenarioId: WalletInteroperabilityChaosScenario['scenarioId'];
    mutate: (source: WalletInteroperabilityFlow[]) => WalletInteroperabilityFlow[];
  }> = [
    {
      scenarioId: 'SD_JWT_SIGNATURE_GAP',
      mutate: (source) => [mutateFlow(source[0], { sdJwt: { signatureVerified: false } })],
    },
    {
      scenarioId: 'OID4VP_NONCE_DROP',
      mutate: (source) => [mutateFlow(source[0], { openid4vp: { nonce: null } })],
    },
    {
      scenarioId: 'REPLAY_NONCE_REUSE',
      mutate: (source) => {
        const first = source[0];
        const second = source[1] ?? source[0];
        return [
          first,
          mutateFlow(second, {
            flowId: second.flowId === first.flowId ? `${second.flowId}-duplicate` : second.flowId,
            replay: { nonce: first.replay.nonce },
          }),
        ];
      },
    },
    {
      scenarioId: 'PORTABILITY_DIGEST_DRIFT',
      mutate: (source) => [mutateFlow(source[0], { portability: { canonicalClaimDigest: null } })],
    },
    {
      scenarioId: 'AMBIGUITY_FLATTENED',
      mutate: (source) => [mutateFlow(source[0], { ambiguity: { state: 'source_gated', preserved: false, refs: [], note: null } })],
    },
    {
      scenarioId: 'FAIL_OPEN_WALLET',
      mutate: (source) => [mutateFlow(source[0], { failClosed: false })],
    },
    {
      scenarioId: 'CONTINUITY_TELEMETRY_DROP',
      mutate: (source) => [mutateFlow(source[0], { continuity: { telemetryRef: null } })],
    },
  ];

  if (!flows.length) {
    const scenarios = scenarioDefs.map(({ scenarioId }) => ({
      scenarioId,
      blocked: true,
      failedGates: [...WALLET_INTEROPERABILITY_CI_GATES],
      verdict: 'WALLET_INTEROPERABILITY_FAIL_CLOSED' as const,
    }));
    return {
      schema: 'vitalcv.wallet-interoperability-chaos.v1',
      generatedAt,
      scenarios,
      survivabilityPct: 100,
    };
  }

  const scenarios = scenarioDefs.map(({ scenarioId, mutate }) => {
    const result = evaluateWalletInteroperability(
      buildWalletInteroperabilityManifest({
        manifestId: `wallet-chaos-${scenarioId.toLowerCase()}`,
        generatedAt,
        flows: mutate(flows),
      }),
    );
    return {
      scenarioId,
      blocked: result.status === 'WALLET_BLOCKED',
      failedGates: result.gateResults.filter((gate) => !gate.pass).map((gate) => gate.gateId),
      verdict: result.verdict,
    };
  });

  return {
    schema: 'vitalcv.wallet-interoperability-chaos.v1',
    generatedAt,
    scenarios,
    survivabilityPct: percent(scenarios.filter((scenario) => scenario.blocked).length, scenarios.length),
  };
}

function buildScores(
  flows: WalletInteroperabilityFlow[],
  duplicateReplayNonces: ReadonlySet<string>,
): WalletInteroperabilityScores {
  const sdJwtFidelityPct = percent(flows.filter(isSdJwtHarmonized).length, flows.length);
  const openid4vpCompatibilityPct = percent(flows.filter(isOpenId4VpCompatible).length, flows.length);
  const replayWalletIntegrityPct = percent(flows.filter((flow) => isReplaySafe(flow, duplicateReplayNonces)).length, flows.length);
  const credentialPortabilityPct = percent(flows.filter(isCredentialPortable).length, flows.length);
  const walletContinuityPct = percent(flows.filter(isContinuityDurable).length, flows.length);
  const ambiguityPct = percent(flows.filter(isAmbiguityPreserved).length, flows.length);
  const failClosedPct = percent(flows.filter((flow) => flow.failClosed).length, flows.length);
  const measurablePct = percent(flows.filter(isInteroperabilityMeasurable).length, flows.length);

  return {
    sdJwtFidelityPct,
    openid4vpCompatibilityPct,
    replayWalletIntegrityPct,
    credentialPortabilityPct,
    walletContinuityPct,
    walletInteroperabilityMaturityPct: Math.round(
      (
        sdJwtFidelityPct +
        openid4vpCompatibilityPct +
        replayWalletIntegrityPct +
        credentialPortabilityPct +
        walletContinuityPct +
        ambiguityPct +
        failClosedPct +
        measurablePct
      ) / 8,
    ),
  };
}

function isSdJwtHarmonized(flow: WalletInteroperabilityFlow): boolean {
  return flow.format === 'sd-jwt-vc'
    && flow.sdJwt.verified
    && flow.sdJwt.signatureVerified
    && flow.sdJwt.keyBindingVerified
    && flow.sdJwt.issuerTrusted
    && ALLOWED_SD_JWT_ALGS.has(flow.sdJwt.alg)
    && flow.sdJwt.disclosureDigests.length > 0
    && flow.sdJwt.disclosedClaims.length > 0;
}

function isOpenId4VpCompatible(flow: WalletInteroperabilityFlow): boolean {
  return flow.openid4vp.requestValidated
    && Boolean(flow.openid4vp.presentationDefinitionId)
    && ALLOWED_RESPONSE_MODES.has(flow.openid4vp.responseMode)
    && Boolean(flow.openid4vp.nonce)
    && Boolean(flow.openid4vp.state)
    && flow.openid4vp.vpTokenPresent
    && flow.openid4vp.audienceVerified;
}

function isReplaySafe(flow: WalletInteroperabilityFlow, duplicateReplayNonces: ReadonlySet<string>): boolean {
  const createdAt = Date.parse(flow.replay.createdAt);
  const expiresAt = Date.parse(flow.replay.expiresAt);
  return Boolean(flow.replay.replayTraceId)
    && Boolean(flow.replay.challenge)
    && Boolean(flow.replay.nonce)
    && Boolean(flow.replay.deterministicFingerprint)
    && Number.isFinite(createdAt)
    && Number.isFinite(expiresAt)
    && expiresAt > createdAt
    && !duplicateReplayNonces.has(flow.replay.nonce ?? '');
}

function isCredentialPortable(flow: WalletInteroperabilityFlow): boolean {
  return PORTABLE_FORMATS.has(flow.format)
    && Boolean(flow.portability.schemaId)
    && Boolean(flow.portability.canonicalClaimDigest)
    && Boolean(flow.portability.revocationRef)
    && Boolean(flow.portability.adapterVersion)
    && flow.portability.crossInstitutionProfiles.length >= 2;
}

function isAmbiguityPreserved(flow: WalletInteroperabilityFlow): boolean {
  if (flow.ambiguity.state === 'none') {
    return flow.ambiguity.preserved;
  }
  return flow.ambiguity.preserved
    && flow.ambiguity.refs.length > 0
    && Boolean(flow.ambiguity.note);
}

function isInteroperabilityMeasurable(flow: WalletInteroperabilityFlow): boolean {
  return Boolean(flow.continuity.telemetryRef)
    && Boolean(flow.continuity.lineageRef)
    && Boolean(flow.continuity.survivabilityRef);
}

function isContinuityDurable(flow: WalletInteroperabilityFlow): boolean {
  return isInteroperabilityMeasurable(flow)
    && Number.isFinite(Date.parse(flow.continuity.observedAt));
}

function isFlowDeterministic(flow: WalletInteroperabilityFlow): boolean {
  return Boolean(flow.replay.deterministicFingerprint)
    && createWalletReplayFingerprint(flow).length === 64
    && isCredentialPortable(flow);
}

function findDuplicateReplayNonces(flows: WalletInteroperabilityFlow[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const flow of flows) {
    const nonce = flow.replay.nonce;
    if (!nonce) continue;
    if (seen.has(nonce)) duplicates.add(nonce);
    seen.add(nonce);
  }
  return duplicates;
}

function compareFlows(a: WalletInteroperabilityFlow, b: WalletInteroperabilityFlow): number {
  return [
    a.continuity.observedAt.localeCompare(b.continuity.observedAt),
    a.institutionId.localeCompare(b.institutionId),
    a.flowId.localeCompare(b.flowId),
    a.credentialId.localeCompare(b.credentialId),
  ].find((comparison) => comparison !== 0) ?? 0;
}

function normalizeFlow(flow: WalletInteroperabilityFlow): Record<string, unknown> {
  return {
    ...flow,
    sdJwt: {
      ...flow.sdJwt,
      disclosureDigests: [...flow.sdJwt.disclosureDigests].sort(),
      disclosedClaims: [...flow.sdJwt.disclosedClaims].sort(),
      withheldClaims: [...flow.sdJwt.withheldClaims].sort(),
    },
    portability: {
      ...flow.portability,
      crossInstitutionProfiles: [...flow.portability.crossInstitutionProfiles].sort(),
    },
    ambiguity: {
      ...flow.ambiguity,
      refs: [...flow.ambiguity.refs].sort(),
    },
  };
}

function mutateFlow(
  flow: WalletInteroperabilityFlow,
  overrides: Partial<Omit<WalletInteroperabilityFlow, 'sdJwt' | 'openid4vp' | 'replay' | 'portability' | 'ambiguity' | 'continuity'>> & {
    sdJwt?: Partial<WalletSdJwtEvidence>;
    openid4vp?: Partial<WalletOpenId4VpEvidence>;
    replay?: Partial<WalletReplayEvidence>;
    portability?: Partial<WalletPortabilityEvidence>;
    ambiguity?: Partial<WalletAmbiguityEvidence>;
    continuity?: Partial<WalletContinuityEvidence>;
  },
): WalletInteroperabilityFlow {
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

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  const seeds = [
    0x811c9dc5,
    0x9e3779b9,
    0x85ebca6b,
    0xc2b2ae35,
    0x27d4eb2f,
    0x165667b1,
    0xd3a2646c,
    0xfd7046c5,
  ];
  return seeds.map((seed, index) => {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i) + index;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }).join('');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(',')}}`;
}
