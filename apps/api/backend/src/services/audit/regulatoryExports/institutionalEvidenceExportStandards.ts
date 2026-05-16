/**
 * institutionalEvidenceExportStandards.ts - W2-PR118A
 *
 * Pure institutional evidence-export standards evaluator. It standardizes
 * replay portability manifests, audit reconstruction exports, cross-system
 * adapter visibility, compatibility scoring, and fail-closed export gates.
 *
 * No fetches, no DB writes, no audit writes. Callers supply already-built
 * export artifacts; this module tells them whether those artifacts are
 * portable, reconstructable, interoperable, and durable enough to hand across
 * institutional boundaries.
 */

import { sha256ForPayload } from '../../../utils/deterministic';

export type InstitutionalEvidenceExportArtifactType =
  | 'REPLAY_PORTABILITY_MANIFEST'
  | 'AUDIT_RECONSTRUCTION_EXPORT'
  | 'CROSS_ORG_EVIDENCE_ADAPTER'
  | 'LINEAGE_SNAPSHOT';

export interface InstitutionalEvidenceExportArtifact {
  artifactId: string;
  artifactType: InstitutionalEvidenceExportArtifactType;
  producedAt: string;
  institutionId: string;
  sourceSystemId: string;
  targetSystemIds: readonly string[];
  schemaId: string;
  schemaVersion: string;
  replayRefs: readonly string[];
  auditEventRefs: readonly string[];
  evidenceHashes: readonly string[];
  lineageRefs: readonly string[];
  adapterRefs: readonly string[];
  portabilityApproved: boolean;
  /** 0..1, evidence-derived compatibility signal for this artifact. */
  compatibilityWeight: number;
  ambiguity: string | null;
}

export interface InstitutionalEvidenceExportManifestEntry {
  position: number;
  artifactId: string;
  artifactType: InstitutionalEvidenceExportArtifactType;
  producedAt: string;
  institutionId: string;
  sourceSystemId: string;
  targetSystemIds: readonly string[];
  schemaId: string;
  schemaVersion: string;
  replayRefCount: number;
  auditEventRefCount: number;
  evidenceHashCount: number;
  lineageRefCount: number;
  adapterRefCount: number;
  portabilityApproved: boolean;
  compatibilityWeight: number;
  ambiguous: boolean;
  artifactHash: string;
}

export interface InstitutionalEvidenceExportManifest {
  schema: 'vitalcv.institutional-evidence-export-manifest.v1';
  exportId: string;
  sourceInstitutionId: string;
  generatedAt: string;
  firstProducedAt: string | null;
  lastProducedAt: string | null;
  targetSystemIds: readonly string[];
  sourceSystemIds: readonly string[];
  artifactTypes: readonly InstitutionalEvidenceExportArtifactType[];
  timeline: readonly InstitutionalEvidenceExportManifestEntry[];
  ambiguityNotes: readonly string[];
  manifestHash: string;
}

export type EvidenceExportStatus =
  | 'EXPORT_READY'
  | 'EXPORT_DEGRADED'
  | 'EXPORT_BLOCKED';

export type EvidenceExportVerdict =
  | 'EXPORT_STANDARDIZED'
  | 'EXPORT_INTEROPERABLE'
  | 'EXPORT_INTEROPERABLE_WITH_AMBIGUITY'
  | 'EXPORT_FAIL_CLOSED';

export interface EvidenceExportStandardsResult {
  schema: 'vitalcv.institutional-evidence-export-standards.v1';
  exportId: string;
  sourceInstitutionId: string;
  generatedAt: string;
  status: EvidenceExportStatus;
  verdict: EvidenceExportVerdict;
  failClosed: boolean;
  exportScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  manifest: InstitutionalEvidenceExportManifest;
  replayPortability: {
    reconstructable: boolean;
    measurable: boolean;
    manifestArtifactCount: number;
    portabilityPct: number;
    replayRefCount: number;
  };
  auditReconstruction: {
    reconstructable: boolean;
    longitudinallyDurable: boolean;
    fidelityPct: number;
    auditEventRefCount: number;
    lineageRefCount: number;
  };
  interoperability: {
    visible: boolean;
    targetSystemIds: readonly string[];
    adapterArtifactCount: number;
    score: number;
  };
  compatibility: {
    scored: boolean;
    score: number;
    schemaCompletenessPct: number;
    evidenceHashCoveragePct: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  exportHash: string;
}

export type EvidenceExportGateId =
  | 'exports_replay_reconstructable'
  | 'ambiguity_preserved_in_exports'
  | 'portability_measurable'
  | 'fail_closed_export_semantics'
  | 'audit_lineage_longitudinally_durable'
  | 'institutional_interoperability_visible'
  | 'export_compatibility_scored';

export interface EvidenceExportGate {
  id: EvidenceExportGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface EvidenceExportGateResult {
  schema: 'vitalcv.institutional-evidence-export-ci-gate.v1';
  pass: boolean;
  gates: readonly EvidenceExportGate[];
  failedGateIds: readonly EvidenceExportGateId[];
  gateHash: string;
}

export type EvidenceExportChaosScenarioName =
  | 'REPLAY_MANIFEST_GAP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'AUDIT_LINEAGE_TRUNCATION'
  | 'CROSS_SYSTEM_ADAPTER_DRIFT'
  | 'COMPATIBILITY_SCHEMA_DRIFT'
  | 'EVIDENCE_HASH_REMOVAL';

export interface EvidenceExportChaosScenarioResult {
  scenario: EvidenceExportChaosScenarioName;
  signalSurfaced: boolean;
  status: EvidenceExportStatus;
  failedGateIds: readonly EvidenceExportGateId[];
  surfacedSignals: readonly string[];
}

export interface EvidenceExportChaosReport {
  schema: 'vitalcv.institutional-evidence-export-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly EvidenceExportChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

export interface EvidenceExportStandardsInput {
  exportId: string;
  generatedAt: string;
  sourceInstitutionId: string;
  artifacts: readonly InstitutionalEvidenceExportArtifact[];
}

const SCHEMA_MANIFEST = 'vitalcv.institutional-evidence-export-manifest.v1' as const;
const SCHEMA_RESULT = 'vitalcv.institutional-evidence-export-standards.v1' as const;
const SCHEMA_GATE = 'vitalcv.institutional-evidence-export-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.institutional-evidence-export-chaos.v1' as const;
const MIN_EXPORT_ARTIFACTS = 3;
const MIN_COMPATIBILITY_SCORE = 75;
const MIN_PORTABILITY_PCT = 75;
const MIN_TARGET_SYSTEMS = 2;

export const EVIDENCE_EXPORT_GATE_IDS: readonly EvidenceExportGateId[] = Object.freeze([
  'exports_replay_reconstructable',
  'ambiguity_preserved_in_exports',
  'portability_measurable',
  'fail_closed_export_semantics',
  'audit_lineage_longitudinally_durable',
  'institutional_interoperability_visible',
  'export_compatibility_scored',
]);

export const EVIDENCE_EXPORT_SENTINELS = Object.freeze({
  manifestSchema: SCHEMA_MANIFEST,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedArtifact {
  artifactId: string;
  artifactType: InstitutionalEvidenceExportArtifactType;
  producedAt: string;
  institutionId: string;
  sourceSystemId: string;
  targetSystemIds: readonly string[];
  schemaId: string;
  schemaVersion: string;
  replayRefs: readonly string[];
  auditEventRefs: readonly string[];
  evidenceHashes: readonly string[];
  lineageRefs: readonly string[];
  adapterRefs: readonly string[];
  portabilityApproved: boolean;
  compatibilityWeight: number;
  ambiguity: string | null;
}

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredString(value: string, fallback: string): string {
  return cleanString(value) ?? fallback;
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map(value => cleanString(value)).filter((value): value is string => value !== null)),
  ).sort();
}

function dedupeChronological(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeArtifacts(
  artifacts: readonly InstitutionalEvidenceExportArtifact[],
): NormalizedArtifact[] {
  return artifacts
    .map((artifact, index) => ({
      artifactId: requiredString(artifact.artifactId, `missing-artifact-${index}`),
      artifactType: artifact.artifactType,
      producedAt: requiredString(artifact.producedAt, '0000-00-00T00:00:00.000Z'),
      institutionId: requiredString(artifact.institutionId, 'missing-institution'),
      sourceSystemId: requiredString(artifact.sourceSystemId, 'missing-source-system'),
      targetSystemIds: dedupeSorted(artifact.targetSystemIds),
      schemaId: requiredString(artifact.schemaId, ''),
      schemaVersion: requiredString(artifact.schemaVersion, ''),
      replayRefs: dedupeSorted(artifact.replayRefs),
      auditEventRefs: dedupeSorted(artifact.auditEventRefs),
      evidenceHashes: dedupeSorted(artifact.evidenceHashes),
      lineageRefs: dedupeSorted(artifact.lineageRefs),
      adapterRefs: dedupeSorted(artifact.adapterRefs),
      portabilityApproved: artifact.portabilityApproved === true,
      compatibilityWeight: clamp01(artifact.compatibilityWeight),
      ambiguity: cleanString(artifact.ambiguity),
    }))
    .sort((left, right) => left.producedAt.localeCompare(right.producedAt) || left.artifactId.localeCompare(right.artifactId));
}

function artifactHash(artifact: NormalizedArtifact): string {
  return sha256ForPayload({
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    producedAt: artifact.producedAt,
    institutionId: artifact.institutionId,
    sourceSystemId: artifact.sourceSystemId,
    targetSystemIds: artifact.targetSystemIds,
    schemaId: artifact.schemaId,
    schemaVersion: artifact.schemaVersion,
    replayRefs: artifact.replayRefs,
    auditEventRefs: artifact.auditEventRefs,
    evidenceHashes: artifact.evidenceHashes,
    lineageRefs: artifact.lineageRefs,
    adapterRefs: artifact.adapterRefs,
    portabilityApproved: artifact.portabilityApproved,
    compatibilityWeight: artifact.compatibilityWeight,
    ambiguity: artifact.ambiguity,
  });
}

function artifactTypes(
  artifacts: readonly NormalizedArtifact[],
): InstitutionalEvidenceExportArtifactType[] {
  const order: readonly InstitutionalEvidenceExportArtifactType[] = [
    'REPLAY_PORTABILITY_MANIFEST',
    'AUDIT_RECONSTRUCTION_EXPORT',
    'CROSS_ORG_EVIDENCE_ADAPTER',
    'LINEAGE_SNAPSHOT',
  ];
  const present = new Set(artifacts.map(artifact => artifact.artifactType));
  return order.filter(type => present.has(type));
}

function schemaComplete(artifact: NormalizedArtifact): boolean {
  return artifact.schemaId.length > 0 && artifact.schemaVersion.length > 0;
}

function hasEvidenceHashes(artifact: NormalizedArtifact): boolean {
  return artifact.evidenceHashes.length > 0;
}

function buildManifestFromNormalized(input: {
  exportId: string;
  generatedAt: string;
  sourceInstitutionId: string;
  artifacts: readonly NormalizedArtifact[];
}): InstitutionalEvidenceExportManifest {
  const timeline: InstitutionalEvidenceExportManifestEntry[] = input.artifacts.map((artifact, index) => ({
    position: index + 1,
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    producedAt: artifact.producedAt,
    institutionId: artifact.institutionId,
    sourceSystemId: artifact.sourceSystemId,
    targetSystemIds: artifact.targetSystemIds,
    schemaId: artifact.schemaId,
    schemaVersion: artifact.schemaVersion,
    replayRefCount: artifact.replayRefs.length,
    auditEventRefCount: artifact.auditEventRefs.length,
    evidenceHashCount: artifact.evidenceHashes.length,
    lineageRefCount: artifact.lineageRefs.length,
    adapterRefCount: artifact.adapterRefs.length,
    portabilityApproved: artifact.portabilityApproved,
    compatibilityWeight: artifact.compatibilityWeight,
    ambiguous: artifact.ambiguity !== null,
    artifactHash: artifactHash(artifact),
  }));
  const targetSystemIds = dedupeSorted(input.artifacts.flatMap(artifact => artifact.targetSystemIds));
  const sourceSystemIds = dedupeSorted(input.artifacts.map(artifact => artifact.sourceSystemId));
  const ambiguityNotes = dedupeChronological(input.artifacts.map(artifact => artifact.ambiguity));
  const body = {
    schema: SCHEMA_MANIFEST,
    exportId: input.exportId,
    sourceInstitutionId: input.sourceInstitutionId,
    generatedAt: input.generatedAt,
    firstProducedAt: timeline[0]?.producedAt ?? null,
    lastProducedAt: timeline[timeline.length - 1]?.producedAt ?? null,
    targetSystemIds,
    sourceSystemIds,
    artifactTypes: artifactTypes(input.artifacts),
    timeline,
    ambiguityNotes,
  };

  return {
    ...body,
    manifestHash: sha256ForPayload(body),
  };
}

export function buildInstitutionalEvidenceExportManifest(
  input: EvidenceExportStandardsInput,
): InstitutionalEvidenceExportManifest {
  return buildManifestFromNormalized({
    ...input,
    artifacts: normalizeArtifacts(input.artifacts),
  });
}

function artifactPortabilityScore(artifact: NormalizedArtifact): number {
  return pct(
    (artifact.replayRefs.length > 0 ? 40 : 0)
      + (hasEvidenceHashes(artifact) ? 25 : 0)
      + (schemaComplete(artifact) ? 20 : 0)
      + (artifact.portabilityApproved ? 15 : 0),
  );
}

function artifactAuditScore(artifact: NormalizedArtifact): number {
  return pct(
    (artifact.auditEventRefs.length > 0 ? 35 : 0)
      + (artifact.lineageRefs.length > 0 ? 35 : 0)
      + (hasEvidenceHashes(artifact) ? 20 : 0)
      + (artifact.replayRefs.length > 0 ? 10 : 0),
  );
}

export function evaluateEvidenceExportStandards(
  input: EvidenceExportStandardsInput,
): EvidenceExportStandardsResult {
  const artifacts = normalizeArtifacts(input.artifacts);
  const manifest = buildManifestFromNormalized({ ...input, artifacts });
  const targetSystemIds = manifest.targetSystemIds;
  const replayManifestArtifacts = artifacts.filter(
    artifact => artifact.artifactType === 'REPLAY_PORTABILITY_MANIFEST',
  );
  const auditReconstructionArtifacts = artifacts.filter(
    artifact => artifact.artifactType === 'AUDIT_RECONSTRUCTION_EXPORT',
  );
  const adapterArtifacts = artifacts.filter(
    artifact => artifact.artifactType === 'CROSS_ORG_EVIDENCE_ADAPTER',
  );
  const portabilityScores = artifacts.map(artifactPortabilityScore);
  const portabilityPct = pct(average(portabilityScores));
  const replayRefCount = artifacts.reduce((sum, artifact) => sum + artifact.replayRefs.length, 0);
  const replayPortabilityReconstructable =
    artifacts.length >= MIN_EXPORT_ARTIFACTS
      && replayManifestArtifacts.length > 0
      && artifacts.every(artifact => artifact.replayRefs.length > 0)
      && artifacts.every(hasEvidenceHashes)
      && artifacts.every(schemaComplete)
      && artifacts.every(artifact => artifact.portabilityApproved);
  const replayPortabilityMeasurable = artifacts.length > 0 && portabilityPct >= MIN_PORTABILITY_PCT;

  const auditScores = artifacts.map(artifactAuditScore);
  const auditFidelityPct = pct(average(auditScores));
  const auditEventRefCount = artifacts.reduce((sum, artifact) => sum + artifact.auditEventRefs.length, 0);
  const lineageRefCount = artifacts.reduce((sum, artifact) => sum + artifact.lineageRefs.length, 0);
  const uniqueProducedAt = new Set(artifacts.map(artifact => artifact.producedAt));
  const auditReconstructable =
    auditReconstructionArtifacts.length > 0
      && artifacts.every(artifact => artifact.auditEventRefs.length > 0)
      && artifacts.every(artifact => artifact.lineageRefs.length > 0)
      && artifacts.every(hasEvidenceHashes);
  const longitudinallyDurable =
    auditReconstructable
      && artifacts.length >= MIN_EXPORT_ARTIFACTS
      && uniqueProducedAt.size >= 3
      && manifest.firstProducedAt !== null
      && manifest.lastProducedAt !== null
      && manifest.firstProducedAt !== manifest.lastProducedAt;

  const schemaCompletenessPct = artifacts.length > 0
    ? pct((artifacts.filter(schemaComplete).length / artifacts.length) * 100)
    : 0;
  const evidenceHashCoveragePct = artifacts.length > 0
    ? pct((artifacts.filter(hasEvidenceHashes).length / artifacts.length) * 100)
    : 0;
  const targetCoveragePct = pct((Math.min(targetSystemIds.length, MIN_TARGET_SYSTEMS) / MIN_TARGET_SYSTEMS) * 100);
  const compatibilityScore = pct(
    average(artifacts.map(artifact => artifact.compatibilityWeight)) * 70
      + schemaCompletenessPct * 0.2
      + evidenceHashCoveragePct * 0.05
      + targetCoveragePct * 0.05,
  );
  const compatibilityScored = artifacts.length > 0 && schemaCompletenessPct > 0;
  const interoperabilityVisible =
    targetSystemIds.length >= MIN_TARGET_SYSTEMS
      && adapterArtifacts.length > 0
      && adapterArtifacts.every(artifact => artifact.adapterRefs.length > 0)
      && compatibilityScore >= MIN_COMPATIBILITY_SCORE;
  const interoperabilityScore = pct(
    targetCoveragePct * 0.45
      + (adapterArtifacts.length > 0 ? 35 : 0)
      + Math.min(20, adapterArtifacts.reduce((sum, artifact) => sum + artifact.adapterRefs.length, 0) * 10),
  );
  const ambiguities = manifest.ambiguityNotes;
  const ambiguityPreserved = dedupeChronological(artifacts.map(artifact => artifact.ambiguity)).length === ambiguities.length;

  const blockers: string[] = [];
  if (!replayPortabilityReconstructable) blockers.push('Replay portability manifest is not reconstructable.');
  if (!longitudinallyDurable) blockers.push('Audit reconstruction export is not durable.');
  if (!compatibilityScored || compatibilityScore < MIN_COMPATIBILITY_SCORE) {
    blockers.push('Export compatibility is below interoperability floor.');
  }
  if (!interoperabilityVisible) blockers.push('Cross-system interoperability is not visible.');

  const failClosed = blockers.length > 0;
  const rawExportScore = pct(
    portabilityPct * 0.3
      + auditFidelityPct * 0.28
      + compatibilityScore * 0.22
      + interoperabilityScore * 0.2,
  );
  const exportScore = failClosed ? Math.min(rawExportScore, 49) : rawExportScore;
  const status: EvidenceExportStatus = failClosed
    ? 'EXPORT_BLOCKED'
    : ambiguities.length > 0 || exportScore < 90
      ? 'EXPORT_DEGRADED'
      : 'EXPORT_READY';
  const verdict: EvidenceExportVerdict = status === 'EXPORT_BLOCKED'
    ? 'EXPORT_FAIL_CLOSED'
    : status === 'EXPORT_READY'
      ? 'EXPORT_STANDARDIZED'
      : ambiguities.length > 0
        ? 'EXPORT_INTEROPERABLE_WITH_AMBIGUITY'
        : 'EXPORT_INTEROPERABLE';
  const basis: string[] = [];
  if (replayPortabilityReconstructable) basis.push('exports_replay_reconstructable');
  if (longitudinallyDurable) basis.push('audit_lineage_longitudinally_durable');
  if (interoperabilityVisible) basis.push('institutional_interoperability_visible');
  if (compatibilityScored && compatibilityScore >= MIN_COMPATIBILITY_SCORE) basis.push('export_compatibility_scored');
  if (replayPortabilityMeasurable) basis.push('portability_measurable');
  if (ambiguityPreserved) basis.push('ambiguity_preserved_in_exports');
  if (!failClosed) basis.push('fail_closed_export_semantics');

  const body = {
    schema: SCHEMA_RESULT,
    exportId: input.exportId,
    sourceInstitutionId: input.sourceInstitutionId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    exportScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    manifestHash: manifest.manifestHash,
    replayPortability: {
      reconstructable: replayPortabilityReconstructable,
      measurable: replayPortabilityMeasurable,
      manifestArtifactCount: replayManifestArtifacts.length,
      portabilityPct,
      replayRefCount,
    },
    auditReconstruction: {
      reconstructable: auditReconstructable,
      longitudinallyDurable,
      fidelityPct: auditFidelityPct,
      auditEventRefCount,
      lineageRefCount,
    },
    interoperability: {
      visible: interoperabilityVisible,
      targetSystemIds,
      adapterArtifactCount: adapterArtifacts.length,
      score: interoperabilityScore,
    },
    compatibility: {
      scored: compatibilityScored,
      score: compatibilityScore,
      schemaCompletenessPct,
      evidenceHashCoveragePct,
    },
    confidence: {
      score: exportScore,
      basis,
    },
  };

  return {
    ...body,
    manifest,
    exportHash: sha256ForPayload(body),
  };
}

export function evaluateEvidenceExportStandardsGate(
  result: EvidenceExportStandardsResult,
): EvidenceExportGateResult {
  const gates: EvidenceExportGate[] = [
    {
      id: 'exports_replay_reconstructable',
      pass: result.replayPortability.reconstructable,
      observed: result.replayPortability.reconstructable,
      required: true,
    },
    {
      id: 'ambiguity_preserved_in_exports',
      pass: result.ambiguityPreserved,
      observed: result.ambiguityPreserved,
      required: true,
    },
    {
      id: 'portability_measurable',
      pass: result.replayPortability.measurable && result.replayPortability.portabilityPct >= MIN_PORTABILITY_PCT,
      observed: result.replayPortability.portabilityPct,
      required: MIN_PORTABILITY_PCT,
    },
    {
      id: 'fail_closed_export_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'audit_lineage_longitudinally_durable',
      pass: result.auditReconstruction.longitudinallyDurable,
      observed: result.auditReconstruction.longitudinallyDurable,
      required: true,
    },
    {
      id: 'institutional_interoperability_visible',
      pass: result.interoperability.visible,
      observed: result.interoperability.visible,
      required: true,
    },
    {
      id: 'export_compatibility_scored',
      pass: result.compatibility.scored && result.compatibility.score >= MIN_COMPATIBILITY_SCORE,
      observed: result.compatibility.score,
      required: MIN_COMPATIBILITY_SCORE,
    },
  ];
  const failedGateIds = gates
    .filter(gate => !gate.pass)
    .map(gate => gate.id);
  const body = {
    schema: SCHEMA_GATE,
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };

  return {
    ...body,
    gateHash: sha256ForPayload(body),
  };
}

function chaosScenario(
  scenario: EvidenceExportChaosScenarioName,
  result: EvidenceExportStandardsResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): EvidenceExportChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateEvidenceExportStandardsGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runEvidenceExportChaosSimulations(
  input: EvidenceExportStandardsInput,
): EvidenceExportChaosReport {
  const baseline = evaluateEvidenceExportStandards(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayGap = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => artifact.artifactType === 'REPLAY_PORTABILITY_MANIFEST'
      ? { ...artifact, replayRefs: [], portabilityApproved: false }
      : artifact),
  });
  const replayGate = evaluateEvidenceExportStandardsGate(replayGap);

  const ambiguitySuppression = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => ({ ...artifact, ambiguity: null })),
  });

  const auditLineageTruncation = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => artifact.artifactType === 'AUDIT_RECONSTRUCTION_EXPORT'
      ? { ...artifact, auditEventRefs: [], lineageRefs: [] }
      : artifact),
  });
  const auditGate = evaluateEvidenceExportStandardsGate(auditLineageTruncation);

  const adapterDrift = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => artifact.artifactType === 'CROSS_ORG_EVIDENCE_ADAPTER'
      ? { ...artifact, artifactType: 'LINEAGE_SNAPSHOT' as const, targetSystemIds: [], adapterRefs: [] }
      : artifact),
  });
  const adapterGate = evaluateEvidenceExportStandardsGate(adapterDrift);

  const schemaDrift = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => ({
      ...artifact,
      schemaId: '',
      schemaVersion: '',
      compatibilityWeight: 0.2,
    })),
  });
  const schemaGate = evaluateEvidenceExportStandardsGate(schemaDrift);

  const evidenceRemoval = evaluateEvidenceExportStandards({
    ...input,
    artifacts: input.artifacts.map(artifact => ({ ...artifact, evidenceHashes: [] })),
  });
  const evidenceGate = evaluateEvidenceExportStandardsGate(evidenceRemoval);

  const ambiguitySuppressed = baselineAmbiguityCount > 0
    && ambiguitySuppression.ambiguities.length < baselineAmbiguityCount;
  const scenarios: EvidenceExportChaosScenarioResult[] = [
    chaosScenario(
      'REPLAY_MANIFEST_GAP',
      replayGap,
      replayGate.failedGateIds.includes('exports_replay_reconstructable'),
      replayGate.failedGateIds,
    ),
    chaosScenario(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppression,
      ambiguitySuppressed,
      ambiguitySuppressed ? ['ambiguity_preserved_in_exports'] : [],
    ),
    chaosScenario(
      'AUDIT_LINEAGE_TRUNCATION',
      auditLineageTruncation,
      auditGate.failedGateIds.includes('audit_lineage_longitudinally_durable'),
      auditGate.failedGateIds,
    ),
    chaosScenario(
      'CROSS_SYSTEM_ADAPTER_DRIFT',
      adapterDrift,
      adapterGate.failedGateIds.includes('institutional_interoperability_visible'),
      adapterGate.failedGateIds,
    ),
    chaosScenario(
      'COMPATIBILITY_SCHEMA_DRIFT',
      schemaDrift,
      schemaGate.failedGateIds.includes('export_compatibility_scored'),
      schemaGate.failedGateIds,
    ),
    chaosScenario(
      'EVIDENCE_HASH_REMOVAL',
      evidenceRemoval,
      evidenceGate.failedGateIds.includes('exports_replay_reconstructable')
        || evidenceGate.failedGateIds.includes('audit_lineage_longitudinally_durable'),
      evidenceGate.failedGateIds,
    ),
  ];
  const body = {
    schema: SCHEMA_CHAOS,
    totalScenarios: scenarios.length,
    silentFailureCount: scenarios.filter(scenario => !scenario.signalSurfaced).length,
    scenarios,
    generatedAt: input.generatedAt,
  };

  return {
    ...body,
    reportHash: sha256ForPayload(body),
  };
}
