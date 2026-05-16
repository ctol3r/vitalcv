/**
 * ncqaExportManifest.ts — W2-PR40A
 *
 * Builds an NCQA-readable export manifest for a single subject (NPI) that
 * binds together: primary-source evidence (per CR 3 element), 120-day
 * timeliness posture per source, decision lineage, override actions, and a
 * deterministic export hash.
 *
 * The manifest is regulator-readable: each entry references the NCQA
 * section it speaks to. The manifest does NOT claim NCQA accreditation.
 *
 * Pure transform — no prisma, no fetches, no audit writes.
 *
 * Banned-string-safe per CLAUDE.md: this module emits regulator semantics,
 * never marketing claims (no "automatically verified", no "complete
 * credentialing", no bare "Verified" status label).
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import {
  getRegulatoryStandard,
  mapAuditEventToStandards,
  type RegulatoryStandardId,
  type RegulatoryStandardReference,
} from './regulatoryTraceability';
import type { AuditEventType } from '../../../types/auditEventTypes';

const NCQA_PSV_WINDOW_DAYS = 120 as const;
const SCHEMA = 'vitalcv.ncqa-export-manifest.v1' as const;

export type NcqaTimelinessVerdict =
  | 'WITHIN_120_DAYS'
  | 'OUTSIDE_120_DAYS'
  | 'AMBIGUOUS_RETRIEVED_AT_MISSING'
  | 'AMBIGUOUS_DECISION_TIME_MISSING';

export interface NcqaSourceEvidence {
  /** Source identifier — e.g. NPPES, STATE_BOARD, DEA. */
  source: string;
  /** Evidence hash anchoring the raw payload. SHA-256 hex. */
  evidenceHash: string;
  /** ISO-8601 retrieval timestamp from the primary source. */
  retrievedAt: string | null;
  /** Outcome label — VERIFIED, EXPIRED, NOT_FOUND, FAILED, PENDING. */
  outcome: string;
  /** NCQA element this source speaks to. */
  ncqaElement: RegulatoryStandardReference;
  /** Days between retrieval and decision time (positive = retrieval is earlier). */
  daysBeforeDecision: number | null;
  /** 120-day NCQA window verdict. */
  timeliness: NcqaTimelinessVerdict;
  /** Audit event row id, if anchored. */
  auditEventId: string | null;
}

export interface NcqaDecisionLineage {
  capsuleId: string;
  decisionType: string;
  decisionTimestamp: string;
  decisionOutcome: string;
  /** Stored vs recomputed artifact hash agreement. */
  hashMatch: boolean;
  /** Tamper evidence string when hashMatch is false; null otherwise. */
  tamperEvidence: string | null;
  ncqaSection: RegulatoryStandardReference;
}

export interface NcqaOverrideEntry {
  auditEventId: string;
  auditEventType: AuditEventType;
  actorId: string;
  occurredAt: string;
  reason: string | null;
  ncqaSection: RegulatoryStandardReference;
}

export interface NcqaAmbiguityNote {
  field: string;
  reason: string;
}

export interface NcqaExportManifest {
  schema: typeof SCHEMA;
  manifestId: string;
  subject: { npi: string; did: string | null };
  generatedAt: string;
  ncqaWindowDays: typeof NCQA_PSV_WINDOW_DAYS;
  /** Section-level coverage summary. Each entry is one NCQA element with the
   *  count of pieces of direct evidence we have. Zero-count entries are kept
   *  so a regulator can see which elements have NO evidence. */
  sectionCoverage: Array<{
    standard: RegulatoryStandardReference;
    directEvidenceCount: number;
    contextEvidenceCount: number;
  }>;
  sources: NcqaSourceEvidence[];
  decisions: NcqaDecisionLineage[];
  overrides: NcqaOverrideEntry[];
  ambiguities: NcqaAmbiguityNote[];
  /** Deterministic SHA-256 over the canonical manifest body (excluding this hash). */
  manifestHash: string;
}

export interface BuildNcqaExportManifestInput {
  manifestId: string;
  subjectNpi: string;
  subjectDid?: string | null;
  generatedAt: string;
  decisionTimestamp: string | null;
  sources: Array<{
    source: string;
    evidenceHash: string;
    retrievedAt: string | null;
    outcome: string;
    auditEventId?: string | null;
  }>;
  decisions: Array<{
    capsuleId: string;
    decisionType: string;
    decisionTimestamp: string;
    decisionOutcome: string;
    hashMatch: boolean;
    tamperEvidence: string | null;
  }>;
  overrides: Array<{
    auditEventId: string;
    auditEventType: AuditEventType;
    actorId: string;
    occurredAt: string;
    reason: string | null;
  }>;
}

function classifyTimeliness(
  retrievedAt: string | null,
  decisionTimestamp: string | null,
): { verdict: NcqaTimelinessVerdict; daysBeforeDecision: number | null } {
  if (!retrievedAt) {
    return { verdict: 'AMBIGUOUS_RETRIEVED_AT_MISSING', daysBeforeDecision: null };
  }
  if (!decisionTimestamp) {
    return { verdict: 'AMBIGUOUS_DECISION_TIME_MISSING', daysBeforeDecision: null };
  }
  const retrievedMs = Date.parse(retrievedAt);
  const decisionMs = Date.parse(decisionTimestamp);
  if (!Number.isFinite(retrievedMs)) {
    return { verdict: 'AMBIGUOUS_RETRIEVED_AT_MISSING', daysBeforeDecision: null };
  }
  if (!Number.isFinite(decisionMs)) {
    return { verdict: 'AMBIGUOUS_DECISION_TIME_MISSING', daysBeforeDecision: null };
  }
  const days = Math.floor((decisionMs - retrievedMs) / (24 * 60 * 60 * 1000));
  return {
    verdict: days >= 0 && days <= NCQA_PSV_WINDOW_DAYS ? 'WITHIN_120_DAYS' : 'OUTSIDE_120_DAYS',
    daysBeforeDecision: days,
  };
}

function ncqaElementForSource(source: string): RegulatoryStandardReference {
  const trace = mapAuditEventToStandards({
    auditEventType: 'VERIFICATION_COMPLETED',
    source,
  });
  // Prefer the most specific element (skip the generic CR 3 umbrella when a
  // sub-element is present). Fall back to AMBIGUOUS_NOT_MAPPED.
  const direct = trace.standards.find(
    (s) =>
      s.standardId !== 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION' &&
      s.standardId !== 'NCQA_CR_120_DAY_TIMELINESS' &&
      s.evidenceWeight === 'DIRECT',
  );
  return direct ?? trace.standards[0] ?? getRegulatoryStandard('AMBIGUOUS_NOT_MAPPED');
}

function ncqaElementForOverride(eventType: AuditEventType): RegulatoryStandardReference {
  const trace = mapAuditEventToStandards({ auditEventType: eventType });
  return trace.standards[0] ?? getRegulatoryStandard('AMBIGUOUS_NOT_MAPPED');
}

function ncqaElementForDecision(): RegulatoryStandardReference {
  return getRegulatoryStandard('NCQA_CR_5_CREDENTIALING_COMMITTEE');
}

function buildSectionCoverage(
  sources: NcqaSourceEvidence[],
  decisions: NcqaDecisionLineage[],
  overrides: NcqaOverrideEntry[],
): NcqaExportManifest['sectionCoverage'] {
  // Every standard we want to surface, regardless of whether it has evidence.
  // Zero-count rows are deliberate so the regulator sees gaps.
  const trackedStandards: RegulatoryStandardId[] = [
    'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION',
    'NCQA_CR_3_LICENSURE_VERIFICATION',
    'NCQA_CR_3_DEA_REGISTRATION',
    'NCQA_CR_3_BOARD_CERTIFICATION',
    'NCQA_CR_3_EDUCATION_AND_TRAINING',
    'NCQA_CR_3_WORK_HISTORY',
    'NCQA_CR_3_MALPRACTICE_HISTORY',
    'NCQA_CR_4_APPLICATION_AND_ATTESTATION',
    'NCQA_CR_5_CREDENTIALING_COMMITTEE',
    'NCQA_CR_6_NOTIFICATION_TO_AUTHORITIES',
    'NCQA_CR_7_PRACTITIONER_RIGHTS',
    'NCQA_CR_8_DELEGATION_OF_CREDENTIALING',
    'NCQA_CR_120_DAY_TIMELINESS',
    'FED_42_CFR_455_106_EXCLUSION_SCREENING',
    'URAC_HP_CR_4_CREDENTIALING_DECISION',
  ];

  const tally = new Map<RegulatoryStandardId, { direct: number; context: number }>();
  for (const id of trackedStandards) {
    tally.set(id, { direct: 0, context: 0 });
  }

  function bump(ref: RegulatoryStandardReference) {
    const slot = tally.get(ref.standardId);
    if (!slot) return;
    if (ref.evidenceWeight === 'DIRECT') {
      slot.direct += 1;
    } else {
      slot.context += 1;
    }
  }

  for (const src of sources) {
    bump(src.ncqaElement);
    if (src.timeliness === 'WITHIN_120_DAYS') {
      bump(getRegulatoryStandard('NCQA_CR_120_DAY_TIMELINESS'));
    }
  }
  for (const decision of decisions) {
    bump(decision.ncqaSection);
  }
  for (const override of overrides) {
    bump(override.ncqaSection);
  }

  return trackedStandards.map((id) => ({
    standard: getRegulatoryStandard(id),
    directEvidenceCount: tally.get(id)?.direct ?? 0,
    contextEvidenceCount: tally.get(id)?.context ?? 0,
  }));
}

function detectAmbiguities(input: BuildNcqaExportManifestInput): NcqaAmbiguityNote[] {
  const notes: NcqaAmbiguityNote[] = [];
  if (!input.decisionTimestamp) {
    notes.push({
      field: 'decisionTimestamp',
      reason: 'No decision timestamp supplied; 120-day timeliness cannot be evaluated for any source.',
    });
  }
  for (const src of input.sources) {
    if (!src.retrievedAt) {
      notes.push({
        field: `sources[${src.source}].retrievedAt`,
        reason: 'Retrieval timestamp missing; preserved without a timeliness verdict.',
      });
    }
  }
  if (input.sources.length === 0) {
    notes.push({
      field: 'sources',
      reason: 'No primary-source evidence is included in this export.',
    });
  }
  if (input.decisions.length === 0) {
    notes.push({
      field: 'decisions',
      reason: 'No decision capsules are included; the export is evidence-only.',
    });
  }
  return notes;
}

export function buildNcqaExportManifest(input: BuildNcqaExportManifestInput): NcqaExportManifest {
  const sources: NcqaSourceEvidence[] = input.sources.map((src) => {
    const { verdict, daysBeforeDecision } = classifyTimeliness(
      src.retrievedAt,
      input.decisionTimestamp,
    );
    return {
      source: src.source,
      evidenceHash: src.evidenceHash,
      retrievedAt: src.retrievedAt,
      outcome: src.outcome,
      ncqaElement: ncqaElementForSource(src.source),
      daysBeforeDecision,
      timeliness: verdict,
      auditEventId: src.auditEventId ?? null,
    };
  });

  const decisions: NcqaDecisionLineage[] = input.decisions.map((d) => ({
    capsuleId: d.capsuleId,
    decisionType: d.decisionType,
    decisionTimestamp: d.decisionTimestamp,
    decisionOutcome: d.decisionOutcome,
    hashMatch: d.hashMatch,
    tamperEvidence: d.tamperEvidence,
    ncqaSection: ncqaElementForDecision(),
  }));

  const overrides: NcqaOverrideEntry[] = input.overrides.map((o) => ({
    auditEventId: o.auditEventId,
    auditEventType: o.auditEventType,
    actorId: o.actorId,
    occurredAt: o.occurredAt,
    reason: o.reason,
    ncqaSection: ncqaElementForOverride(o.auditEventType),
  }));

  // Deterministic ordering — sort sources by name, decisions by timestamp,
  // overrides by occurredAt. This is what makes the manifest hash stable.
  sources.sort((a, b) => a.source.localeCompare(b.source));
  decisions.sort((a, b) => a.decisionTimestamp.localeCompare(b.decisionTimestamp));
  overrides.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const sectionCoverage = buildSectionCoverage(sources, decisions, overrides);
  const ambiguities = detectAmbiguities(input);

  const body = {
    schema: SCHEMA,
    manifestId: input.manifestId,
    subject: { npi: input.subjectNpi, did: input.subjectDid ?? null },
    generatedAt: input.generatedAt,
    ncqaWindowDays: NCQA_PSV_WINDOW_DAYS,
    sectionCoverage,
    sources,
    decisions,
    overrides,
    ambiguities,
  };

  return {
    ...body,
    manifestHash: sha256ForPayload(body),
  };
}

export function isNcqaExportManifestComplete(manifest: NcqaExportManifest): boolean {
  // "Complete" here means: at least one direct piece of evidence under CR 3,
  // at least one decision recorded under CR 5, and exclusion screening present.
  // It does NOT mean NCQA-certified.
  const hasCr3Direct = manifest.sectionCoverage.some(
    (row) =>
      (row.standard.standardId === 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION' ||
        row.standard.standardId === 'NCQA_CR_3_LICENSURE_VERIFICATION' ||
        row.standard.standardId === 'NCQA_CR_3_BOARD_CERTIFICATION' ||
        row.standard.standardId === 'NCQA_CR_3_DEA_REGISTRATION') &&
      row.directEvidenceCount > 0,
  );
  const hasCr5 = manifest.sectionCoverage.some(
    (row) =>
      row.standard.standardId === 'NCQA_CR_5_CREDENTIALING_COMMITTEE' &&
      row.directEvidenceCount > 0,
  );
  const hasExclusion = manifest.sectionCoverage.some(
    (row) =>
      row.standard.standardId === 'FED_42_CFR_455_106_EXCLUSION_SCREENING' &&
      row.directEvidenceCount > 0,
  );
  return hasCr3Direct && hasCr5 && hasExclusion;
}

export const NCQA_EXPORT_SCHEMA = SCHEMA;
export const NCQA_PSV_WINDOW = NCQA_PSV_WINDOW_DAYS;
