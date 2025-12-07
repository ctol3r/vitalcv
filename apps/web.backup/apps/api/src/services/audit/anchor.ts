import { createHash, randomUUID } from 'crypto';
import type { AuditScrapbookRecord, ChainReceipt } from '../chain/client';
import { ChainClient } from '../chain/client';
import type { LicenseFields } from '../psv/ocr/rules';
import type { TemplateDetectionResult } from '../psv/templates';
import { recordBlockProof } from '../chain/proofs';
import type { ProofMetrics } from '../zk/prover';

export interface OcrAnchorRequest {
  clinicianId: string;
  documentId: string;
  ocrHashSource: string | Buffer;
  fields: LicenseFields;
  template: TemplateDetectionResult;
  metadata?: Record<string, unknown>;
  auditService?: AuditAnchorService;
}

export interface SurgeReadinessAnchorRequest {
  surgePoolId: string;
  clinicianId: string;
  readinessScore: number;
  metadata?: Record<string, unknown>;
  auditService?: AuditAnchorService;
}

export class AuditAnchorService {
  private readonly client: ChainClient;

  constructor(client: ChainClient = new ChainClient()) {
    this.client = client;
  }

  async anchor(record: AuditScrapbookRecord): Promise<ChainReceipt> {
    return this.client.submitAuditEvent(record);
  }
}

export async function anchorOcrExtraction(request: OcrAnchorRequest): Promise<ChainReceipt> {
  const service = request.auditService ?? new AuditAnchorService();
  const ocrHash = hashValue(request.ocrHashSource);
  const fieldsHash = hashValue({
    licenseNumber: request.fields.licenseNumber,
    expirationDate: request.fields.expirationDate,
    stateCode: request.fields.stateCode,
  });

  const payload: AuditScrapbookRecord = {
    eventType: 'OCR_VERIFICATION',
    correlationId: `${request.clinicianId}:${request.documentId}`,
    tags: ['psv', 'ocr', 'license'],
    payload: {
      clinicianId: request.clinicianId,
      documentId: request.documentId,
      ocrHash,
      fieldsHash,
      fieldsExtracted: {
        licenseNumber: request.fields.licenseNumber,
        expirationDate: request.fields.expirationDate,
        stateCode: request.fields.stateCode,
      },
      template: {
        type: request.template.templateType,
        source: request.template.sourceType,
        confidence: request.template.confidence,
      },
      metadata: request.metadata ?? {},
      anchoredAt: new Date().toISOString(),
    },
  };

  return service.anchor(payload);
}

export async function anchorSurgeReadiness(
  request: SurgeReadinessAnchorRequest
): Promise<ChainReceipt> {
  const service = request.auditService ?? new AuditAnchorService();
  const payload: AuditScrapbookRecord = {
    eventType: 'SURGE_READINESS',
    correlationId: `${request.surgePoolId}:${request.clinicianId}`,
    tags: ['surge', 'readiness', 'workforce'],
    payload: {
      surgePoolId: request.surgePoolId,
      clinicianId: request.clinicianId,
      readinessScore: Number(request.readinessScore.toFixed(4)),
      readinessHash: hashValue({
        clinicianId: request.clinicianId,
        score: request.readinessScore,
      }),
      metadata: request.metadata ?? {},
      anchoredAt: new Date().toISOString(),
    },
  };

  return service.anchor(payload);
}

function hashValue(value: unknown): string {
  const normalized =
    typeof value === 'string' || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value);
  return createHash('sha256').update(normalized).digest('hex');
}

function buildMerklePath(txHash: string, merkleRoot: string): string[] {
  const limbA = `0x${createHash('sha256').update(txHash).digest('hex')}`;
  const limbB = `0x${createHash('sha256').update(limbA).digest('hex')}`;
  const limbC = `0x${createHash('sha256').update(merkleRoot).digest('hex')}`;
  return [limbA, limbB, limbC];
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

export type AnchorEventType =
  | 'trustedIssuerAdded'
  | 'trustedIssuerRemoved'
  | 'trustBreachDetected'
  | 'federationAdded'
  | 'federationRemoved'
  | 'auditEvidenceCommitted'
  | 'ncqaFileComplete'
  | 'evidencePackAnchored'
  | 'compactEligible'
  | 'compactRevoked'
  | 'privilegeEmergencyIssued'
  | 'privilegeEmergencyRevoked'
  | 'privilegeAssigned'
  | 'deaMateCredentialIssued'
  | 'contractLock'
  | 'contractRelease'
  | 'contractRefund'
  | 'privilegePropagated'
  | 'licenseAutofillVerified'
  | 'routingDispatched'
  | 'foreignCredentialAdded'
  | 'equivalencyEvaluated'
  | 'equivalencyDecision'
  | 'readinessDelta'
  | 'profileUpdated'
  | 'inviteSent'
  | 'recoveryInitiated'
  | 'recoveryVerified'
  | 'keysRotated'
  | 'riskGraphHash'
  | 'provenanceVerified'
  | 'provenanceSuspect'
  | 'indexSnapshot'
  | 'globalLicenseVerified'
  | 'globalLicenseExpired'
  | 'warrantyIssued'
  | 'aiDecisionRecorded'
  | 'atsScreenCompleted'
  | 'ruleSetUpdated'
  | 'chainHealthSnapshot'
  | 'monitoringScanAnchored'
  | 'fusionRootAnchored'
  | 'multiPartyCredentialAnchored'
  | 'multiPartyCredentialRevoked'
  | 'onboardingKineticsAnchored'
  | 'onboardingCheckpointAnchored'
  | 'capacityScenarioAnchored'
  | 'walletLinked'
  | 'proofStreamCheckpoint'
  | 'npiValidationAnchored'
  | 'mobilitySnapshot'
  | 'safetyCorrelationAnchored'
  | 'identityForensicsRecorded'
  | 'identityFusionAnchored'
  | 'streamSubscriptionRegistered'
  | 'hrisSyncAnchored'
  | 'credentialFabricAnchored'
  | 'trustAnchorAnchored'
  | 'observabilityAnchored'
  | 'uxConfigAnchored'
  | 'workforceGridAnchored'
  | 'walletInteropAnchored'
  | 'zkAuditProofAnchored'
  | 'safetyGraphAnchored'
  | 'reputationLayerAnchored'
  | 'regulatoryInteropAnchored'
  | 'pathwayAnchored'
  | 'employerOnboardingAnchored'
  | 'identityContinuityAnchored'
  | 'experienceTimelineAnchored'
  | 'safetyExchangeAnchored'
  | 'automationKernelAnchored'
  | 'verifierCheckAnchored'
  | 'meshAnchored'
  | 'accelerationAnchored'
  | 'workforceGraphAnchored'
  | 'credentialReliabilityAnchored'
  | 'privilegeIntelAnchored'
  | 'hiringPulseAnchored'
  | 'identityProofAnchored'
  | 'credentialPerformanceAnchored'
  | 'globalTrustAnchored'
  | 'vcExchangeAnchored'
  | 'procedureVolumeAnchored'
  | 'providerIndexAnchored'
  | 'proofUXAnchored'
  | 'privilegeAlignmentAnchored'
  | 'ontologyAnchored'
  | 'safetyMeshAnchored'
  | 'liquidityIntelligenceAnchored'
  | 'employerMaturityAnchored'
  | 'didSyncAnchored'
  | 'crossBorderBridgeAnchored'
  | 'routingGridAnchored'
  | 'trustPersonaAnchored'
  | 'reputationMeshAnchored'
  | 'complianceSignalAnchored'
  | 'chainAttestationAnchored'
  | 'verificationCopilotAnchored'
  | 'licenseContinuityAnchored'
  | 'employerBehaviorEconomicsAnchored'
  | 'chainStabilityAnchored'
  | 'regInteropLayerAnchored'
  | 'workforceEfficiencyAnchored'
  | 'credentialForensicsAnchored'
  | 'regulatoryIntelligenceAnchored'
  | 'flexibilityAnchored'
  | 'employerComplianceNavigatorAnchored'
  | 'workforceSentimentAnchored'
  | 'credentialFusionFabricAnchored'
  | 'recoveryMeshAnchored'
  | 'routingKernelAnchored'
  | 'credentialAssuranceAnchored'
  | 'operationalIntelligenceAnchored'
  | 'complianceHorizonAnchored'
  | 'talentResonanceAnchored'
  | 'reconciliationFabricAnchored'
  | 'clinicianEmployerTrustAnchored'
  | 'credentialTimelineAnchored'
  | 'complianceStressAnchored'
  | 'hiringFairnessAnchored'
  | 'talentGravityAnchored'
  | 'auditabilityKernelAnchored'
  | 'trustTrajectoryAnchored'
  | 'contractHealthAnchored'
  | 'credentialLatencyAnchored'
  | 'regScenarioAnchored'
  | 'readinessGaugeAnchored'
  | 'aiRiskSentinelAnchored'
  | 'trustSynthesisAnchored'
  | 'credentialCoherenceAnchored'
  | 'talentEquilibriumAnchored'
  | 'regImpactGridAnchored'
  | 'workforceErosionAnchored'
  | 'attestationReinforcementAnchored'
  | 'credentialConsensusAnchored'
  | 'workforceMaturityAnchored'
  | 'identityFabricAnchored'
  | 'ruleDiffIntelligenceAnchored'
  | 'predictiveFlowAnchored'
  | 'riskHardeningAnchored'
  | 'temporalAlignmentAnchored'
  | 'employerBehaviorTensorAnchored'
  | 'competencyRoleFusionAnchored'
  | 'regulatoryConfidenceAnchored'
  | 'workforceVolatilityAnchored'
  | 'chainConsensusAnchored'
  | 'globalMobilityIntelligenceAnchored'
  | 'trustlineGraphReactorAnchored';

export interface AnchorRecord<TPayload extends Record<string, any> = Record<string, any>> {
  id: string;
  type: AnchorEventType;
  payload: TPayload & { timestamp: string };
  txHash: string;
  merkleRoot: string;
  network: string;
  merklePath?: string[];
}

export interface AnchorFilter {
  type?: AnchorEventType;
  clinicianId?: string;
  limit?: number;
}

const DEFAULT_NETWORK = process.env.VERIFIER_CHAIN_NETWORK || 'pilot-l2';
const MAX_ANCHOR_EVENTS = 500;
const anchorLog: AnchorRecord[] = [];

export function anchorEvent<TPayload extends Record<string, any>>(
  type: AnchorEventType,
  payload: TPayload & { timestamp?: string },
): AnchorRecord<TPayload> {
  const timestamp = payload.timestamp ?? new Date().toISOString();
  const serialized = JSON.stringify({ type, payload, timestamp });
  const txHash = `0x${createHash('sha256').update(serialized).digest('hex')}`;
  const merkleRoot = `0x${createHash('sha256').update(txHash).digest('hex')}`;
  const merklePath = buildMerklePath(txHash, merkleRoot);

  const record: AnchorRecord<TPayload> = {
    id: randomUUID(),
    type,
    payload: {
      ...payload,
      timestamp,
    },
    txHash,
    merkleRoot,
    network: DEFAULT_NETWORK,
    merklePath,
  };

  anchorLog.unshift(record);
  if (anchorLog.length > MAX_ANCHOR_EVENTS) {
    anchorLog.pop();
  }

  recordBlockProof({
    eventId: record.id,
    blockHash: txHash,
    merklePath,
    eventType: type,
    palletName: 'audit.scrapbook',
    timestamp,
  }).catch((error) => console.warn('[audit][anchor] block proof persist failed', error));

  return record;
}

export function listAnchorEvents(filter: AnchorFilter = {}): AnchorRecord[] {
  const filtered = anchorLog.filter((record) => {
    if (filter.type && record.type !== filter.type) {
      return false;
    }
    if (filter.clinicianId && record.payload?.clinicianId !== filter.clinicianId) {
      return false;
    }
    return true;
  });

  if (filter.limit && filter.limit > 0) {
    return filtered.slice(0, filter.limit);
  }

  return filtered;
}

export function anchorTrustEvent(
  event: Extract<AnchorEventType, 'trustedIssuerAdded' | 'trustedIssuerRemoved'>,
  payload: { did: string; orgNpi: string; orgName?: string; actor?: string; timestamp?: string },
) {
  return anchorEvent(event, payload);
}

export function anchorTrustBreach(
  payload: { issuerDid: string; reason: string; detectedAt?: string; metadata?: Record<string, any> },
) {
  return anchorEvent('trustBreachDetected', {
    ...payload,
    detectedAt: payload.detectedAt ?? new Date().toISOString(),
  });
}

export function anchorFederationChange(
  event: Extract<AnchorEventType, 'federationAdded' | 'federationRemoved'>,
  payload: { parentDid: string; childDid: string; trustLevel: number; actor?: string; timestamp?: string },
) {
  return anchorEvent(event, payload);
}

export function anchorCompactChange(
  event: Extract<AnchorEventType, 'compactEligible' | 'compactRevoked'>,
  payload: { clinicianId: string; compact: string; reason?: string; homeState?: string; actor?: string; timestamp?: string },
) {
  return anchorEvent(event, payload);
}

export interface PrivilegePropagationAnchorPayload {
  clinicianId: string;
  siteId: string;
  packId: string;
  systemId?: string;
  propagatedAt?: string;
  auto?: boolean;
  reasons?: string[];
}

export function anchorPrivilegePropagation(payload: PrivilegePropagationAnchorPayload) {
  return anchorEvent('privilegePropagated', {
    ...payload,
    merkleProof: {
      root: hashValue(payload),
      path: buildMerklePath(hashValue(payload), hashValue(`${payload.packId}:${payload.siteId}`)),
    },
  });
}

export interface PrivilegeAssignmentAnchorInput {
  clinicianId: string;
  privilegeCodes: string[];
  siteIds?: string[];
  packetId?: string;
  reviewerId?: string;
  decision?: 'approved' | 'revoked' | 'hold';
  rationale?: string[];
  timestamp?: string;
}

export function anchorPrivilegeAssignment(input: PrivilegeAssignmentAnchorInput) {
  const privilegeCodes = dedupeStrings((input.privilegeCodes ?? []).map((code) => code.toUpperCase()));
  const siteIds = dedupeStrings(input.siteIds ?? []);
  return anchorEvent('privilegeAssigned', {
    clinicianId: input.clinicianId,
    privilegeCodes,
    siteIds,
    packetId: input.packetId ?? null,
    reviewerId: input.reviewerId ?? null,
    decision: input.decision ?? 'approved',
    rationale: input.rationale ?? [],
    decisionHash: hashValue({
      clinicianId: input.clinicianId,
      privilegeCodes,
      siteIds,
      decision: input.decision ?? 'approved',
    }),
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export interface LicenseAutofillAnchorInput {
  clinicianId: string;
  source: string;
  matchedFields: string[];
  confidenceScore: number;
  licenseData: Record<string, unknown>;
  suggestionId?: string;
  actor?: string;
}

export function anchorLicenseAutofillVerification(input: LicenseAutofillAnchorInput) {
  return anchorEvent('licenseAutofillVerified', {
    clinicianId: input.clinicianId,
    source: input.source,
    matchedFields: input.matchedFields,
    confidenceScore: Number(input.confidenceScore.toFixed(4)),
    licenseDataHash: hashValue(input.licenseData),
    suggestionId: input.suggestionId ?? null,
    actor: input.actor ?? 'system',
  });
}

export function anchorIdentityForensics(payload: {
  clinicianId: string;
  riskScore: number;
  signalsHash: string;
}) {
  return anchorEvent('identityForensicsRecorded', {
    clinicianId: payload.clinicianId,
    riskScore: Number(payload.riskScore.toFixed(2)),
    signalsHash: payload.signalsHash,
  });
}

export function anchorRoutingDispatch(payload: {
  clinicianId: string;
  targetSystem: string;
  method: string;
  status: string;
  requestId: string;
  envelopeHash: string;
}) {
  return anchorEvent('routingDispatched', payload);
}

export function anchorOnboardingCheckpoint(payload: {
  checkpointId: string;
  clinicianId: string;
  step: string;
  status: string;
  blockerCode?: string;
}) {
  return anchorEvent('onboardingCheckpointAnchored', {
    ...payload,
    checkpointHash: hashValue(payload),
  });
}

export interface EvidencePackAnchorPayload {
  clinicianId: string;
  packId: string;
  packType: string;
  packHash: string;
  warnings?: string[];
  generatedAt?: string;
}

export function anchorEvidencePack(payload: EvidencePackAnchorPayload) {
  return anchorEvent('evidencePackAnchored', {
    clinicianId: payload.clinicianId,
    packId: payload.packId,
    packType: payload.packType,
    packHash: payload.packHash,
    warnings: payload.warnings ?? [],
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
  });
}

export interface SafetyCorrelationAnchorPayload {
  clinicianId: string;
  generatedAt?: string;
  signalCount: number;
  privilegingScore: number;
  matchingScore: number;
  windowDays: number;
  anomalies?: string[];
}

export function anchorSafetyCorrelationSummary(payload: SafetyCorrelationAnchorPayload) {
  return anchorEvent('safetyCorrelationAnchored', {
    clinicianId: payload.clinicianId,
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    signalCount: payload.signalCount,
    privilegingScore: Number(payload.privilegingScore.toFixed(4)),
    matchingScore: Number(payload.matchingScore.toFixed(4)),
    windowDays: payload.windowDays,
    anomalies: payload.anomalies ?? [],
  });
}

export function anchorNpiValidationScore(payload: {
  clinicianId: string;
  npi: string;
  score: number;
  status: 'pass' | 'review' | 'fail';
  mismatches: number;
  summary?: string | null;
}) {
  return anchorEvent('npiValidationAnchored', {
    clinicianId: payload.clinicianId,
    npi: payload.npi,
    score: Number(payload.score.toFixed(4)),
    status: payload.status,
    mismatches: payload.mismatches,
    summary: payload.summary ?? null,
  });
}

export function anchorStreamSubscriptionRegistration(payload: {
  subscriptionId: string;
  orgId: string;
  topic: string;
  endpoint: string;
  subscriptionHash: string;
  timestamp?: string;
}) {
  return anchorEvent('streamSubscriptionRegistered', {
    ...payload,
    endpointHash: hashValue(payload.endpoint),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorZkAuditProof(payload: {
  eventId: string;
  circuitType: string;
  ledgerRoot: string;
  proofCommitment: string;
  proofHash: string;
  metrics: ProofMetrics;
}) {
  return anchorEvent('zkAuditProofAnchored', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function anchorHrisSyncLog(payload: {
  orgId: string;
  vendor: string;
  action: string;
  status: 'success' | 'failed' | 'partial';
  attempts: number;
  region?: string;
  logHash: string;
  metadata?: Record<string, unknown>;
  connectionId?: string;
}) {
  return anchorEvent('hrisSyncAnchored', {
    orgId: payload.orgId,
    vendor: payload.vendor,
    action: payload.action,
    status: payload.status,
    attempts: payload.attempts,
    region: payload.region ?? null,
    logHash: payload.logHash,
    connectionId: payload.connectionId ?? null,
    metadata: payload.metadata ?? {},
    timestamp: new Date().toISOString(),
  });
}

export function anchorGlobalLicenseVerification(payload: {
  clinicianId: string;
  authority: string;
  country: string;
  licenseNumber: string;
  status: string;
  recordHash: string;
}) {
  return anchorEvent('globalLicenseVerified', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function anchorGlobalLicenseExpiration(payload: {
  clinicianId: string;
  authority: string;
  country: string;
  licenseNumber: string;
  expiresAt?: string | null;
  recordHash: string;
}) {
  return anchorEvent('globalLicenseExpired', {
    ...payload,
    expiresAt: payload.expiresAt ?? null,
    timestamp: new Date().toISOString(),
  });
}

export function anchorMobilitySnapshot(payload: {
  clinicianId: string;
  passportId: string;
  mobilityScore: number;
  statesEligible: string[];
  compacts: Array<{ compact: string; status: string; coverage: number }>;
  countries: string[];
  snapshotHash: string;
}) {
  return anchorEvent('mobilitySnapshot', {
    clinicianId: payload.clinicianId,
    passportId: payload.passportId,
    mobilityScore: Number(payload.mobilityScore.toFixed(2)),
    statesEligible: dedupeStrings(payload.statesEligible.map((state) => state.toUpperCase())),
    compacts: payload.compacts,
    countries: dedupeStrings(payload.countries.map((country) => country.toUpperCase())),
    snapshotHash: payload.snapshotHash,
  });
}

export function anchorForeignCredentialAdded(payload: {
  clinicianId: string;
  credentialId: string;
  country: string;
  identifiers?: Record<string, unknown>;
}) {
  return anchorEvent('foreignCredentialAdded', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function anchorAtsScreenVerdict(payload: {
  clinicianId: string;
  orgId?: string | null;
  verdict: string;
  components: Array<{ key: string; status: string; detail: string; metadata?: Record<string, unknown> }>;
  runAt?: string;
}) {
  return anchorEvent('atsScreenCompleted', {
    clinicianId: payload.clinicianId,
    orgId: payload.orgId ?? null,
    verdict: payload.verdict,
    components: payload.components,
    runAt: payload.runAt ?? new Date().toISOString(),
  });
}

export interface ProvenanceAnchorPayload {
  docId: string;
  clinicianId: string;
  verdict: 'verified' | 'suspicious';
  confidence: number;
  captureTimestamp?: string | null;
  captureDevice?: string | null;
  gps?: { lat: number; lng: number; accuracyMeters?: number } | null;
  warnings?: string[];
}

export function anchorProvenanceVerdict(payload: ProvenanceAnchorPayload) {
  const type: AnchorEventType =
    payload.verdict === 'verified' ? 'provenanceVerified' : 'provenanceSuspect';
  return anchorEvent(type, {
    clinicianId: payload.clinicianId,
    documentId: payload.docId,
    confidence: Number(payload.confidence.toFixed(4)),
    captureTimestamp: payload.captureTimestamp ?? null,
    captureDevice: payload.captureDevice ?? null,
    gps: payload.gps ?? null,
    warnings: payload.warnings ?? [],
  });
}

export function anchorEquivalencyEvaluated(payload: {
  clinicianId: string;
  credentialId: string;
  country: string;
  equivalencyLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
  usEquivalent?: string;
}) {
  return anchorEvent('equivalencyEvaluated', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function anchorEquivalencyDecision(payload: {
  clinicianId: string;
  country: string;
  foreignType: string;
  level: 'FULL' | 'PARTIAL' | 'MANUAL';
  reviewerId: string;
  notes?: string;
}) {
  return anchorEvent('equivalencyDecision', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export interface WalletLinkedAnchorPayload {
  clinicianId: string;
  walletType: string;
  walletHandle?: string | null;
  provider?: string | null;
  passkeyBinding?: boolean;
  presentationProfile?: string;
}

export function anchorWalletLinked(payload: WalletLinkedAnchorPayload) {
  return anchorEvent('walletLinked', {
    ...payload,
    provider: payload.provider ?? 'unknown',
    passkeyBinding: payload.passkeyBinding ?? false,
    timestamp: new Date().toISOString(),
  });
}

export function anchorFusionRoot(payload: {
  clinicianId: string;
  rootHash: string;
  componentCount: number;
  conflictCount: number;
  validationErrors?: number;
  timestamp?: string;
}) {
  return anchorEvent('fusionRootAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorMultiPartyCredential(payload: {
  multiCredentialId: string;
  baseCredentialId: string;
  participantDids: string[];
  rootHash: string;
  proofCount: number;
}) {
  const participants = dedupeStrings(payload.participantDids);
  return anchorEvent('multiPartyCredentialAnchored', {
    multiCredentialId: payload.multiCredentialId,
    baseCredentialId: payload.baseCredentialId,
    participantDids: participants,
    participantHash: hashValue(participants),
    rootHash: payload.rootHash,
    proofCount: payload.proofCount,
    timestamp: new Date().toISOString(),
  });
}

export function anchorMultiPartyRevocation(payload: {
  multiCredentialId: string;
  baseCredentialId: string;
  participantDids: string[];
  reason: string;
  revokedBy: string;
  rootHash?: string | null;
}) {
  const participants = dedupeStrings(payload.participantDids);
  return anchorEvent('multiPartyCredentialRevoked', {
    multiCredentialId: payload.multiCredentialId,
    baseCredentialId: payload.baseCredentialId,
    participantDids: participants,
    reason: payload.reason,
    revokedBy: payload.revokedBy,
    rootHash: payload.rootHash ?? null,
    timestamp: new Date().toISOString(),
  });
}

export function anchorMarketplaceProfileUpdate(payload: {
  clinicianId: string;
  visibility: string;
  specialties: string[];
  regions: string[];
  orgId?: string;
  specialtyFilters?: string[];
}) {
  return anchorEvent('profileUpdated', {
    ...payload,
    orgId: payload.orgId ?? 'self-managed',
    specialtyFilters: payload.specialtyFilters ?? payload.specialties ?? [],
    timestamp: new Date().toISOString(),
  });
}

export function anchorMarketplaceInvite(payload: {
  clinicianId: string;
  jobId: string;
  orgId: string;
  recruiterId: string;
  specialtyFilters?: string[];
}) {
  return anchorEvent('inviteSent', {
    ...payload,
    specialtyFilters: payload.specialtyFilters ?? [],
    timestamp: new Date().toISOString(),
  });
}

export function anchorRuleSetUpdated(payload: {
  authorityCode: string;
  snapshotId: string;
  diffHash: string;
  changes: {
    newRequirements: number;
    removedFields: number;
    changedRenewalWindows: number;
  };
  metadata?: Record<string, unknown>;
}) {
  return anchorEvent('ruleSetUpdated', {
    authorityCode: payload.authorityCode,
    snapshotId: payload.snapshotId,
    diffHash: payload.diffHash,
    changeSummary: payload.changes,
    metadata: payload.metadata ?? {},
    timestamp: new Date().toISOString(),
    ruleSetHash: hashValue({
      authorityCode: payload.authorityCode,
      diffHash: payload.diffHash,
      snapshotId: payload.snapshotId,
      changes: payload.changes,
    }),
  });
}

export function anchorRecoveryEvent(
  event: Extract<AnchorEventType, 'recoveryInitiated' | 'recoveryVerified' | 'keysRotated'>,
  payload: {
    clinicianId: string;
    recoveryMethod: string;
    sessionId: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  },
) {
  return anchorEvent(event, {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorRiskGraphSnapshot(payload: {
  clinicianId: string;
  nodeScores: Array<{ id: string; severity: number }>;
  edges: Array<{ fromSignal: string; toSignal: string; weight: number }>;
  severityState: number;
  focusSignal?: string;
  timestamp?: string;
}) {
  return anchorEvent('riskGraphHash', {
    ...payload,
    graphHash: hashValue({
      clinicianId: payload.clinicianId,
      nodes: payload.nodeScores,
      edges: payload.edges,
      severity: payload.severityState,
      focus: payload.focusSignal,
    }),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorAiDecision(payload: {
  decisionId: string;
  decision: string;
  outcome: string;
  confidence: number;
  topFeature?: string | null;
  riskTags?: string[];
  biasFlags?: Array<{ feature: string; severity: string }>;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}) {
  return anchorEvent('aiDecisionRecorded', {
    decisionId: payload.decisionId,
    decision: payload.decision,
    outcome: payload.outcome,
    confidence: Number(payload.confidence.toFixed(4)),
    topFeature: payload.topFeature ?? null,
    riskTags: payload.riskTags ?? [],
    biasFlags: payload.biasFlags ?? [],
    metadata: payload.metadata ?? {},
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export interface OnboardingKineticsAnchorPayload {
  clinicianId: string;
  orgId?: string | null;
  projectedCompletionDate: string;
  efficiencyScore: number;
  readinessScore: number;
  phases: Array<{ phase: string; durationDays: number; confidence: number }>;
  bottlenecks: Array<{ type: string; severity: string; confidence: number }>;
}

export function anchorOnboardingKineticsSnapshot(payload: OnboardingKineticsAnchorPayload) {
  return anchorEvent('onboardingKineticsAnchored', {
    clinicianId: payload.clinicianId,
    orgId: payload.orgId ?? null,
    projectedCompletionDate: payload.projectedCompletionDate,
    efficiencyScore: Number(payload.efficiencyScore.toFixed(4)),
    readinessScore: Number(payload.readinessScore.toFixed(4)),
    phases: payload.phases.map((phase) => ({
      phase: phase.phase,
      durationDays: Number(phase.durationDays.toFixed(2)),
      confidence: Number(phase.confidence.toFixed(3)),
    })),
    bottlenecks: payload.bottlenecks.map((bottleneck) => ({
      type: bottleneck.type,
      severity: bottleneck.severity,
      confidence: Number(bottleneck.confidence.toFixed(3)),
    })),
    timestamp: new Date().toISOString(),
  });
}

export function anchorCapacityScenario(payload: {
  scenarioId?: string | null;
  orgId: string;
  name: string;
  paramsHash: string;
  horizonMonths: number;
  specialties: number;
  vitalCvLift?: number;
  actor?: string;
}) {
  return anchorEvent('capacityScenarioAnchored', {
    scenarioId: payload.scenarioId ?? null,
    orgId: payload.orgId,
    name: payload.name,
    paramsHash: payload.paramsHash,
    horizonMonths: payload.horizonMonths,
    specialties: payload.specialties,
    vitalCvLift: Number((payload.vitalCvLift ?? 0).toFixed(2)),
    actor: payload.actor ?? 'system',
    timestamp: new Date().toISOString(),
  });
}

export function anchorIdentityFusion(payload: {
  clinicianId: string;
  rootHash: string;
  sourceCount: number;
  conflictCount: number;
  resolvedCount: number;
  reliabilityScore: number;
  timestamp?: string;
}) {
  return anchorEvent('identityFusionAnchored', {
    clinicianId: payload.clinicianId,
    rootHash: payload.rootHash,
    sourceCount: payload.sourceCount,
    conflictCount: payload.conflictCount,
    resolvedCount: payload.resolvedCount,
    reliabilityScore: Number(payload.reliabilityScore.toFixed(4)),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorCredentialFabricSnapshot(payload: {
  clinicianId: string;
  version: number;
  componentCount: number;
  conflictCount: number;
  integrityScore: number;
  crossChainRoot?: string | null;
}) {
  return anchorEvent('credentialFabricAnchored', {
    ...payload,
    crossChainRoot: payload.crossChainRoot ?? null,
    snapshotHash: hashValue({
      clinicianId: payload.clinicianId,
      version: payload.version,
      components: payload.componentCount,
      conflicts: payload.conflictCount,
    }),
  });
}

export function anchorTrustAnchorSnapshot(payload: {
  entityDid: string;
  entityType: string;
  score: number;
  contributingSignals: Array<{ label: string; weight: number }>;
  alerts?: string[];
}) {
  return anchorEvent('trustAnchorAnchored', {
    ...payload,
    score: Number(payload.score.toFixed(4)),
    alerts: payload.alerts ?? [],
    signalsHash: hashValue(payload.contributingSignals),
    timestamp: new Date().toISOString(),
  });
}

export function anchorObservabilitySnapshot(payload: {
  region: string;
  metricHash: string;
  alertCount: number;
  dominantAlert?: string | null;
}) {
  return anchorEvent('observabilityAnchored', {
    region: payload.region,
    metricHash: payload.metricHash,
    alertCount: payload.alertCount,
    dominantAlert: payload.dominantAlert ?? null,
    timestamp: new Date().toISOString(),
  });
}

export function anchorUxConfig(payload: { role: string; version: number; hash: string }) {
  return anchorEvent('uxConfigAnchored', {
    role: payload.role,
    version: payload.version,
    hash: payload.hash,
    timestamp: new Date().toISOString(),
  });
}

export function anchorWorkforceGridSnapshot(payload: {
  region: string;
  nodeCount: number;
  highRiskNodes: number;
  snapshotHash: string;
}) {
  return anchorEvent('workforceGridAnchored', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function anchorWalletInteropConfig(payload: {
  wallet: string;
  schemaHash: string;
  conformance: number;
  testMatrixHash?: string;
}) {
  return anchorEvent('walletInteropAnchored', {
    wallet: payload.wallet,
    schemaHash: payload.schemaHash,
    conformance: Number(payload.conformance.toFixed(4)),
    testMatrixHash: payload.testMatrixHash ?? null,
    timestamp: new Date().toISOString(),
  });
}

export function anchorWorkforceGraphSnapshot(payload: {
  nodeCount: number;
  edgeCount: number;
  graphHash: string;
  timestamp?: string;
}) {
  return anchorEvent('workforceGraphAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorCredentialReliabilitySummary(payload: {
  credentialId: string;
  score: number;
  signalsHash: string;
  timestamp?: string;
}) {
  return anchorEvent('credentialReliabilityAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorPrivilegeIntelSnapshot(payload: {
  clinicianId: string;
  intelHash: string;
  confidence: number;
  timestamp?: string;
}) {
  return anchorEvent('privilegeIntelAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorHiringPulseSnapshot(payload: {
  region: string;
  pulseHash: string;
  demandTotal: number;
  timestamp?: string;
}) {
  return anchorEvent('hiringPulseAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorIdentityProofState(payload: {
  sessionId: string;
  trustLevel: number;
  compliant: boolean;
  protocolHash: string;
  timestamp?: string;
}) {
  return anchorEvent('identityProofAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorCredentialPerformanceSnapshot(payload: {
  clinicianId: string;
  healthScore: number;
  performanceHash: string;
  timestamp?: string;
}) {
  return anchorEvent('credentialPerformanceAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorRegulatoryIntelligence(payload: {
  region: string;
  intelHash: string;
  changeCount: number;
  driftFlagCount: number;
  timestamp?: string;
}) {
  return anchorEvent('regulatoryIntelligenceAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorFlexibility(payload: {
  clinicianId: string;
  flexibilityHash: string;
  roleSwitchabilityScore: number;
  crossPrivilegeScore: number;
  deployableRegionsCount: number;
  timestamp?: string;
}) {
  return anchorEvent('flexibilityAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorEmployerComplianceNavigator(payload: {
  orgId: string;
  navigatorHash: string;
  complianceScore: number;
  gapCount: number;
  actionPlanSteps: number;
  timestamp?: string;
}) {
  return anchorEvent('employerComplianceNavigatorAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorWorkforceSentiment(payload: {
  region: string;
  sentimentHash: string;
  overallSentiment: number;
  burnoutRisk: number;
  retentionScore: number;
  timestamp?: string;
}) {
  return anchorEvent('workforceSentimentAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorCredentialFusionFabric(payload: {
  clinicianId: string;
  fusionHash: string;
  sourceCount: number;
  conflictCount: number;
  crossChainNetworks: number;
  timestamp?: string;
}) {
  return anchorEvent('credentialFusionFabricAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorRecoveryMesh(payload: {
  recoveryHash: string;
  failureCount: number;
  activeRecoveryAgents: number;
  healthyServices: number;
  timestamp?: string;
}) {
  return anchorEvent('recoveryMeshAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorContractHealthSnapshot(payload: {
  contractHealthId: string;
  healthHash: string;
  timestamp?: string;
}) {
  return anchorEvent('contractHealthAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorCredentialLatencySnapshot(payload: {
  credentialId: string;
  latencySummaryHash: string;
  throughputSummaryHash: string;
  timestamp?: string;
}) {
  return anchorEvent('credentialLatencyAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorRegScenarioSnapshot(payload: {
  scenarioId: string;
  rulesHash: string;
  impactHash: string;
  timestamp?: string;
}) {
  return anchorEvent('regScenarioAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorReadinessGaugeSnapshot(payload: {
  scope: string;
  readinessScore: number;
  metricHash: string;
  timestamp?: string;
}) {
  return anchorEvent('readinessGaugeAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

export function anchorAIRiskSentinelSnapshot(payload: {
  agentId: string;
  sentinelConfigHash: string;
  incidentSummaryHash: string;
  timestamp?: string;
}) {
  return anchorEvent('aiRiskSentinelAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 412 — Credential Consensus Vector Engine v7
export function anchorCredentialConsensusVector(payload: {
  credentialId: string;
  vectorHash: string;
  consensusScore: number;
  sourceCount: number;
  contradictionCount: number;
  timestamp?: string;
}) {
  return anchorEvent('credentialConsensusAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 413 — Employer Workforce Maturity Model v7
export function anchorWorkforceMaturity(payload: {
  orgId: string;
  maturityScore: number;
  stage: string;
  maturityHash: string;
  timestamp?: string;
}) {
  return anchorEvent('workforceMaturityAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 414 — Clinician Multiverse Identity Fabric v6
export function anchorIdentityFabric(payload: {
  clinicianId: string;
  fabricHash: string;
  identityCount: number;
  collisionCount: number;
  coherenceScore: number;
  timestamp?: string;
}) {
  return anchorEvent('identityFabricAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 415 — Regulatory Rule-Diff Intelligence Engine v8
export function anchorRuleDiffIntelligence(payload: {
  region: string;
  diffHash: string;
  changeCount: number;
  severityCounts: { minor: number; medium: number; high: number; critical: number };
  timestamp?: string;
}) {
  return anchorEvent('ruleDiffIntelligenceAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 416 — Workforce Predictive Flow Model v7
export function anchorPredictiveFlow(payload: {
  region: string;
  flowHash: string;
  predictedMovements: number;
  divergenceCount: number;
  timestamp?: string;
}) {
  return anchorEvent('predictiveFlowAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 417 — Chain-Integrated Risk Hardening Matrix v6
export function anchorRiskHardening(payload: {
  clinicianId: string;
  matrixHash: string;
  riskScore: number;
  stabilizationActions: number;
  timestamp?: string;
}) {
  return anchorEvent('riskHardeningAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 430 — Credential Temporal Alignment Engine v7
export function anchorTemporalAlignment(payload: {
  credentialId: string;
  alignmentHash: string;
  consistencyScore: number;
  conflictCount: number;
  timestamp?: string;
}) {
  return anchorEvent('temporalAlignmentAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 431 — Employer Behavioral Forecast Tensor v8
export function anchorEmployerBehaviorTensor(payload: {
  orgId: string;
  tensorHash: string;
  driftPredicted: boolean;
  anomalyCount: number;
  timestamp?: string;
}) {
  return anchorEvent('employerBehaviorTensorAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 432 — Clinician Competency-Role Fusion Grid v7
export function anchorCompetencyRoleFusion(payload: {
  clinicianId: string;
  fusionHash: string;
  roleCount: number;
  driftDetected: boolean;
  timestamp?: string;
}) {
  return anchorEvent('competencyRoleFusionAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 433 — Regulatory Confidence Map v8
export function anchorRegulatoryConfidence(payload: {
  clinicianId: string;
  confidenceHash: string;
  overallConfidence: number;
  conflictCount: number;
  timestamp?: string;
}) {
  return anchorEvent('regulatoryConfidenceAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 434 — Workforce Predictive Volatility Engine v7
export function anchorWorkforceVolatility(payload: {
  region: string;
  volatilityHash: string;
  volatilityIndex: number;
  specialtyCount: number;
  timestamp?: string;
}) {
  return anchorEvent('workforceVolatilityAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

// Batch 435 — Chain Integrity Consensus Reactor v7
export function anchorChainConsensus(payload: {
  consensusHash: string;
  integrityScore: number;
  quorumSatisfied: boolean;
  health: string;
  timestamp?: string;
}) {
  return anchorEvent('chainConsensusAnchored', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}


