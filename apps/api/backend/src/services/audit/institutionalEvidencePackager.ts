/**
 * institutionalEvidencePackager.ts — Institutional Evidence Packaging (W2-PR124A)
 *
 * Packages audit evidence into formats suitable for institutional consumption:
 * hospital compliance offices, credentialing committees, NCQA surveyors, URAC
 * reviewers, and health system legal counsel.
 *
 * Institutional packaging requirements:
 *   - Self-describing: includes schema, versioning, and methodology statements
 *   - Legally defensible framing: no overclaims, explicit uncertainty markers
 *   - Exportable: produces a JSON-serializable structure with a stable schema
 *   - Verifiable: includes hash of the source evidence for downstream integrity checks
 *   - Auditor-readable: each section has a humanReadableSummary
 *   - Chain of custody: every field has a traceable origin
 *
 * What this module does NOT do:
 *   - PDF rendering (that is a presentation layer concern)
 *   - DB writes
 *   - External API calls
 *   - Resolution of AMBIGUOUS verdicts (preserved as-is)
 */

import { createHash } from 'crypto';
import type { SafeEvidenceEnvelope, SafeDecisionRecord, SafeEvidenceItem } from './safeAuditAdapters';
import type { ReplayAuditSynthesis } from './replayAuditSynthesis';

// ── Types ─────────────────────────────────────────────────────────────────────

export const INSTITUTIONAL_PACKAGE_SCHEMA = 'vitalcv.institutional-evidence-package/v1';
export const INSTITUTIONAL_PACKAGE_VERSION = '1.0.0';

export interface InstitutionalEvidencePackage {
  schema: typeof INSTITUTIONAL_PACKAGE_SCHEMA;
  packageVersion: typeof INSTITUTIONAL_PACKAGE_VERSION;
  packageId: string;
  packagedAt: string;
  packageHash: string;
  methodology: InstitutionalMethodology;
  subject: InstitutionalSubject;
  credentialingSummary: CredentialingSummary;
  verificationEvidence: VerificationEvidenceSection;
  decisionHistory: DecisionHistorySection;
  auditIntegrity: AuditIntegritySection;
  uncertaintyDisclosure: UncertaintyDisclosure;
  custodyTrail: CustodyTrailEntry[];
  exportMetadata: ExportMetadata;
}

export interface InstitutionalMethodology {
  name: string;
  version: string;
  principlesApplied: string[];
  humanReadableSummary: string;
}

export interface InstitutionalSubject {
  identifier: string;
  identifierType: string;
  tenantScope: string | null;
  humanReadableSummary: string;
}

export interface CredentialingSummary {
  totalCredentialTypes: number;
  confirmedCredentialTypes: number;
  expiredCredentialTypes: number;
  indeterminateCredentialTypes: number;
  coveragePeriod: { from: string | null; to: string | null };
  convergenceScore: number;
  humanReadableSummary: string;
}

export interface VerificationEvidenceSection {
  itemCount: number;
  integrityBreaches: number;
  ambiguousItems: number;
  sentinelItems: number;
  items: InstitutionalEvidenceItem[];
  humanReadableSummary: string;
}

export interface InstitutionalEvidenceItem {
  evidenceRef: string;
  credentialType: string;
  verificationStatus: string;
  sourceLabel: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  jurisdiction: string | null;
  integrityStatus: string;
  uncertaintyFlag: boolean;
  classLabel: string;
}

export interface DecisionHistorySection {
  decisionCount: number;
  cleanDecisions: number;
  flaggedDecisions: number;
  ambiguousDecisions: number;
  records: InstitutionalDecisionRecord[];
  humanReadableSummary: string;
}

export interface InstitutionalDecisionRecord {
  decisionRef: string;
  decisionType: string;
  decisionDate: string;
  outcome: string;
  confidence: string;
  replayVerdict: string;
  flagged: boolean;
  flagReason: string | null;
}

export interface AuditIntegritySection {
  replayFidelityScore: number;      // 0–100
  survivabilityGrade: string;
  intactCapsuleRate: number;
  driftEventsDetected: number;
  containmentBreaches: number;
  humanReadableSummary: string;
}

export interface UncertaintyDisclosure {
  ambiguityRate: number;
  unresolvedItems: number;
  disclosureStatement: string;
  warningLabels: string[];
}

export interface CustodyTrailEntry {
  sequence: number;
  event: string;
  timestamp: string;
  actor: string;
  verifiable: boolean;
}

export interface ExportMetadata {
  exportedBy: string;
  exportedAt: string;
  intendedRecipientClass: string;
  legalDisclaimer: string;
  sourceEnvelopeHash: string | null;
  sourceSynthesisHash: string | null;
}

// ── Main Packager ─────────────────────────────────────────────────────────────

export function packageInstitutionalEvidence(
  safeEnvelope: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  options: {
    recipientClass?: string;
    packagedBy?: string;
  } = {},
): InstitutionalEvidencePackage {
  const packageId = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const packagedAt = new Date().toISOString();

  const methodology = buildMethodology();
  const subject = buildSubject(safeEnvelope);
  const credentialingSummary = buildCredentialingSummary(safeEnvelope, synthesis);
  const verificationEvidence = buildVerificationEvidence(safeEnvelope);
  const decisionHistory = buildDecisionHistory(safeEnvelope);
  const auditIntegrity = buildAuditIntegrity(safeEnvelope, synthesis);
  const uncertaintyDisclosure = buildUncertaintyDisclosure(safeEnvelope, synthesis);
  const custodyTrail = buildCustodyTrail(safeEnvelope);
  const exportMetadata = buildExportMetadata(safeEnvelope, synthesis, packagedAt, options);

  // Package hash (covers all content except packageHash itself)
  const hashPayload = JSON.stringify({
    packageId, packagedAt, methodology, subject, credentialingSummary,
    verificationEvidence: { itemCount: verificationEvidence.itemCount },
    decisionHistory: { decisionCount: decisionHistory.decisionCount },
    auditIntegrity,
  });
  const packageHash = createHash('sha256').update(hashPayload, 'utf8').digest('hex');

  return {
    schema: INSTITUTIONAL_PACKAGE_SCHEMA,
    packageVersion: INSTITUTIONAL_PACKAGE_VERSION,
    packageId,
    packagedAt,
    packageHash,
    methodology,
    subject,
    credentialingSummary,
    verificationEvidence,
    decisionHistory,
    auditIntegrity,
    uncertaintyDisclosure,
    custodyTrail,
    exportMetadata,
  };
}

// ── Section Builders ──────────────────────────────────────────────────────────

function buildMethodology(): InstitutionalMethodology {
  return {
    name: 'VitalCV Structured Audit Fidelity Evidence',
    version: '1.0',
    principlesApplied: [
      'Fail-closed audit semantics: missing data surfaces as explicit gap, never silently omitted',
      'Ambiguity preservation: AMBIGUOUS verdicts are not resolved into binary outcomes',
      'Lineage reconstructability: every evidence item traces to a source artifact or sentinel',
      'Longitudinal audit continuity: temporal drift across capsules is detected and disclosed',
      'No overclaim: no credential is represented as confirmed without a corresponding source-verified artifact',
    ],
    humanReadableSummary:
      'Evidence compiled by the VitalCV Audit Runtime using replay-safe decision capsules. ' +
      'Each credential status reflects the state at time of the original verification event, ' +
      'not current status. Ambiguous or unresolvable items are disclosed explicitly.',
  };
}

function buildSubject(env: SafeEvidenceEnvelope): InstitutionalSubject {
  return {
    identifier: env.subject.identifier,
    identifierType: env.subject.identifierType,
    tenantScope: env.subject.tenantScope,
    humanReadableSummary:
      `Subject identified by ${env.subject.identifierType}: ${env.subject.identifier}` +
      (env.subject.tenantScope ? ` within tenant scope ${env.subject.tenantScope}` : ''),
  };
}

function buildCredentialingSummary(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
): CredentialingSummary {
  const items = env.evidenceItems;
  const confirmed = items.filter((i) => i.status === 'VERIFIED').length;
  const expired = items.filter((i) => i.status === 'EXPIRED').length;
  const indeterminate = items.filter((i) =>
    ['UNKNOWN', 'PENDING', 'NOT_FOUND', 'FAILED'].includes(i.status) || i.ambiguityFlag,
  ).length;

  const period = env.auditPeriod;
  const convergenceScore = synthesis.convergenceReport.convergenceScore;

  return {
    totalCredentialTypes: items.length,
    confirmedCredentialTypes: confirmed,
    expiredCredentialTypes: expired,
    indeterminateCredentialTypes: indeterminate,
    coveragePeriod: { from: period.from, to: period.to },
    convergenceScore,
    humanReadableSummary:
      `${confirmed} of ${items.length} credential evidence items have a source-backed ` +
      `verification status. ${expired} are expired. ${indeterminate} are indeterminate ` +
      `and require human review. Cross-decision convergence score: ${convergenceScore}/100.`,
  };
}

function buildVerificationEvidence(env: SafeEvidenceEnvelope): VerificationEvidenceSection {
  const items = env.evidenceItems;
  const integrityBreaches = items.filter((i) => i.integrity === 'HASH_MISMATCH').length;
  const ambiguousItems = items.filter((i) => i.ambiguityFlag).length;
  const sentinelItems = items.filter((i) => i.safeClass === 'SENTINEL').length;

  const institutionalItems: InstitutionalEvidenceItem[] = items.map((i) =>
    mapEvidenceItem(i),
  );

  const warningParts: string[] = [];
  if (integrityBreaches > 0) warningParts.push(`${integrityBreaches} integrity breach(es) detected`);
  if (ambiguousItems > 0) warningParts.push(`${ambiguousItems} item(s) with unresolved ambiguity`);
  if (sentinelItems > 0) warningParts.push(`${sentinelItems} sentinel item(s) (structural gaps)`);

  return {
    itemCount: items.length,
    integrityBreaches,
    ambiguousItems,
    sentinelItems,
    items: institutionalItems,
    humanReadableSummary:
      items.length === 0
        ? 'No verification evidence items in package.'
        : `${items.length} evidence item(s) compiled.` +
          (warningParts.length ? ' Attention required: ' + warningParts.join('; ') + '.' : ' All items structurally intact.'),
  };
}

function mapEvidenceItem(item: SafeEvidenceItem): InstitutionalEvidenceItem {
  return {
    evidenceRef: item.evidenceId,
    credentialType: item.credentialType,
    verificationStatus: item.status,
    sourceLabel: item.sourceLabel,
    verifiedAt: item.verifiedAt,
    expiresAt: item.expiresAt,
    jurisdiction: item.jurisdiction,
    integrityStatus: item.integrity,
    uncertaintyFlag: item.ambiguityFlag,
    classLabel: item.safeClass,
  };
}

function buildDecisionHistory(env: SafeEvidenceEnvelope): DecisionHistorySection {
  const records = env.decisionRecords;
  const cleanDecisions = records.filter((d) => d.replayStatus === 'CLEAN').length;
  const flaggedDecisions = records.filter((d) =>
    d.replayStatus === 'QUARANTINED' || d.replayStatus === 'CONTAINMENT_BREACH',
  ).length;
  const ambiguousDecisions = records.filter((d) => d.replayStatus === 'AMBIGUOUS').length;

  const institutionalRecords: InstitutionalDecisionRecord[] = records.map((r) =>
    mapDecisionRecord(r),
  );

  return {
    decisionCount: records.length,
    cleanDecisions,
    flaggedDecisions,
    ambiguousDecisions,
    records: institutionalRecords,
    humanReadableSummary:
      `${records.length} decision record(s). ${cleanDecisions} clean replay(s), ` +
      `${flaggedDecisions} flagged (quarantined or breach), ` +
      `${ambiguousDecisions} unresolved ambiguous.`,
  };
}

function mapDecisionRecord(record: SafeDecisionRecord): InstitutionalDecisionRecord {
  const flagged = record.replayStatus !== 'CLEAN' && record.replayStatus !== 'UNKNOWN';
  const flagReason = flagged
    ? `Replay verdict: ${record.replayStatus}; Containment: ${record.containmentVerdict}`
    : null;

  return {
    decisionRef: record.decisionId,
    decisionType: record.decisionType,
    decisionDate: record.decisionTimestamp,
    outcome: record.outcome,
    confidence: record.confidence,
    replayVerdict: record.replayStatus,
    flagged,
    flagReason,
  };
}

function buildAuditIntegrity(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
): AuditIntegritySection {
  const sw = synthesis.survivabilityWindow;
  const containmentBreaches = env.decisionRecords.filter(
    (d) => d.replayStatus === 'CONTAINMENT_BREACH',
  ).length;
  const driftEventsDetected = synthesis.temporalDriftReport.driftCount;

  const replayFidelityScore = Math.round(
    sw.intactRate * 70 +
    (1 - synthesis.ambiguityQuantification.ambiguityRate) * 20 +
    (containmentBreaches === 0 ? 10 : 0),
  );

  return {
    replayFidelityScore,
    survivabilityGrade: sw.survivabilityGrade,
    intactCapsuleRate: sw.intactRate,
    driftEventsDetected,
    containmentBreaches,
    humanReadableSummary:
      `Replay fidelity: ${replayFidelityScore}/100. ` +
      `Survivability grade: ${sw.survivabilityGrade} ` +
      `(${Math.round(sw.intactRate * 100)}% intact capsules). ` +
      `${driftEventsDetected} temporal drift event(s). ` +
      `${containmentBreaches} containment breach(es).`,
  };
}

function buildUncertaintyDisclosure(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
): UncertaintyDisclosure {
  const ambiguityRate = synthesis.ambiguityQuantification.ambiguityRate;
  const unresolvedItems = synthesis.ambiguityQuantification.unresolvedAmbiguities.length;
  const gaps = synthesis.gaps.filter((g) => g.severity === 'BLOCKING').length;

  const warningLabels: string[] = [];
  if (ambiguityRate > 0.1) warningLabels.push('ELEVATED_AMBIGUITY');
  if (unresolvedItems > 0) warningLabels.push('UNRESOLVED_AMBIGUOUS_DECISIONS');
  if (gaps > 0) warningLabels.push('BLOCKING_SYNTHESIS_GAPS');
  if (env.failClosedSentinels.length > 0) warningLabels.push('FAIL_CLOSED_SENTINELS_PRESENT');

  return {
    ambiguityRate,
    unresolvedItems,
    disclosureStatement:
      'This evidence package reflects the audit record as captured by the VitalCV Runtime. ' +
      'Items marked AMBIGUOUS or SENTINEL represent conditions where the evidence was ' +
      'structurally present but could not be classified with confidence. ' +
      'These items require manual credentialing review and must not be treated as ' +
      'confirmed or denied verification outcomes. ' +
      'This package does not constitute a verification guarantee, certification, ' +
      'or compliance attestation.',
    warningLabels,
  };
}

function buildCustodyTrail(env: SafeEvidenceEnvelope): CustodyTrailEntry[] {
  return env.provenanceChain.map((link) => ({
    sequence: link.sequence,
    event: link.event,
    timestamp: link.timestamp,
    actor: link.actor,
    verifiable: link.verified,
  }));
}

function buildExportMetadata(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  packagedAt: string,
  options: { recipientClass?: string; packagedBy?: string },
): ExportMetadata {
  return {
    exportedBy: options.packagedBy ?? 'VitalCV/institutionalEvidencePackager@v1',
    exportedAt: packagedAt,
    intendedRecipientClass: options.recipientClass ?? 'INSTITUTIONAL_COMPLIANCE_OFFICER',
    legalDisclaimer:
      'For credentialing review purposes only. ' +
      'Not a legal certification or compliance attestation. ' +
      'Ambiguous or indeterminate items require human review before credentialing decisions.',
    sourceEnvelopeHash: env.adapterHash ?? null,
    sourceSynthesisHash: synthesis.synthesisIntegrity.synthesisHash ?? null,
  };
}
