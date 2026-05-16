/**
 * ncqaValidationGate.ts — W2-PR40A
 *
 * In-process assertion suite that validates the regulatory-export modules
 * uphold their NCQA semantics. Designed to be called from a CI script
 * (`scripts/ncqa-validation.ts`) and a scale test. Returns a structured
 * verdict — never throws — so the caller decides exit code / log shape.
 *
 * The gate enforces:
 *   1. The 120-day NCQA window constant is the single source of truth.
 *   2. A baseline manifest is deterministic across two builds.
 *   3. Tampering an evidence hash produces a different manifest hash.
 *   4. Out-of-window retrieval flips the timeliness verdict.
 *   5. The traceability map handles every AuditEventType we know about
 *      without falling through to AMBIGUOUS_NOT_MAPPED unless intentional.
 *   6. Regulator-readable strings emitted by these modules contain none
 *      of the banned phrases from CLAUDE.md.
 */
import {
  buildNcqaExportManifest,
  isNcqaExportManifestComplete,
  NCQA_PSV_WINDOW,
  type BuildNcqaExportManifestInput,
} from './ncqaExportManifest';
import { mapAuditEventToStandards } from './regulatoryTraceability';
import { runNcqaManifestChaos } from './complianceChaosSimulation';
import type { AuditEventType } from '../../../types/auditEventTypes';

export interface NcqaValidationCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface NcqaValidationVerdict {
  ok: boolean;
  passed: number;
  failed: number;
  checks: NcqaValidationCheck[];
}

const BANNED_PHRASES: string[] = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'HIPAA compliant',
  'SOC2 certified',
];

const BARE_VERIFIED_LABEL = 'Verified';

const KNOWN_AUDIT_EVENT_TYPES: AuditEventType[] = [
  'VERIFICATION_REQUESTED',
  'VERIFICATION_COMPLETED',
  'VERIFICATION_FAILED',
  'MONITORING_STATUS_CHANGE',
  'ARTIFACT_VIEWED',
  'ARTIFACT_EXPORTED',
  'BUNDLE_GENERATED',
  'EMPLOYER_REVIEW_ACCEPTED',
  'EMPLOYER_REVIEW_REFRESH_REQUESTED',
  'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
  'EMPLOYER_REVIEW_MUTATION_DENIED',
  'EMPLOYER_PACKET_SHARED',
  'APPLICATION_MISSING_INFO_REQUESTED',
  'APPLICATION_MISSING_INFO_CLOSED',
  'RECOGNITION_EMITTED',
  'ACCEPTANCE_EMITTED',
  'START_EMITTED',
  'START_ATTESTED',
  'RATE_LIMIT_HIT',
  'API_ERROR',
  'VALIDATION_ERROR',
  'TRUST_STATE_CHECK',
  'RESEARCH_PUBMED_FETCHED',
  'RESEARCH_ORCID_LINKED',
  'RESEARCH_ORCID_UNLINKED',
  'RESEARCH_TRIALS_FETCHED',
  'RESEARCH_SCORE_COMPUTED',
  'RESEARCH_DISCLOSURE_UPDATED',
];

function fixtureManifestInput(): BuildNcqaExportManifestInput {
  return {
    manifestId: 'ncqa-validation-fixture',
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    generatedAt: '2026-05-09T00:00:00.000Z',
    decisionTimestamp: '2026-05-01T12:00:00.000Z',
    sources: [
      {
        source: 'NPPES',
        evidenceHash: 'a'.repeat(64),
        retrievedAt: '2026-04-20T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-1',
      },
      {
        source: 'STATE_BOARD',
        evidenceHash: 'b'.repeat(64),
        retrievedAt: '2026-04-22T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-2',
      },
      {
        source: 'OIG_LEIE',
        evidenceHash: 'c'.repeat(64),
        retrievedAt: '2026-04-25T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-3',
      },
      {
        source: 'BOARD_CERTIFICATION',
        evidenceHash: 'd'.repeat(64),
        retrievedAt: '2026-04-26T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-4',
      },
      {
        source: 'DEA',
        evidenceHash: 'e'.repeat(64),
        retrievedAt: '2026-04-27T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-5',
      },
    ],
    decisions: [
      {
        capsuleId: 'capsule-1',
        decisionType: 'HIRING',
        decisionTimestamp: '2026-05-01T12:00:00.000Z',
        decisionOutcome: 'APPROVED',
        hashMatch: true,
        tamperEvidence: null,
      },
    ],
    overrides: [
      {
        auditEventId: 'override-1',
        auditEventType: 'EMPLOYER_REVIEW_ACCEPTED',
        actorId: 'user_employer_1',
        occurredAt: '2026-05-02T09:00:00.000Z',
        reason: 'Employer accepted dossier for pilot deployment.',
      },
    ],
  };
}

function pushCheck(checks: NcqaValidationCheck[], id: string, passed: boolean, detail: string) {
  checks.push({ id, passed, detail });
}

function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const banned of BANNED_PHRASES) {
    if (lower.includes(banned.toLowerCase())) return banned;
  }
  return null;
}

function containsBareVerifiedStatus(text: string): boolean {
  // Match a bare-word "Verified" used as a status label — not just any
  // substring. We approximate by looking for "status: Verified" or a
  // standalone "Verified" with no preceding word it's modifying.
  const re = /\b(?:status|verdict|state|label|outcome)\s*[:=]\s*(?:"|')?Verified(?:"|')?\b/;
  return re.test(text);
}

function checkBannedStrings(checks: NcqaValidationCheck[]): void {
  const manifest = buildNcqaExportManifest(fixtureManifestInput());

  // Walk every regulator-readable string in the manifest body.
  const regulatorText: string[] = [];
  for (const row of manifest.sectionCoverage) {
    regulatorText.push(row.standard.label, row.standard.section);
  }
  for (const note of manifest.ambiguities) {
    regulatorText.push(note.reason);
  }
  for (const src of manifest.sources) {
    regulatorText.push(src.ncqaElement.label, src.ncqaElement.section);
  }

  // Also pull traceability rationales for every known event type.
  for (const type of KNOWN_AUDIT_EVENT_TYPES) {
    regulatorText.push(mapAuditEventToStandards({ auditEventType: type }).rationale);
  }

  let bannedHit: { phrase: string; sample: string } | null = null;
  for (const text of regulatorText) {
    const phrase = containsBannedPhrase(text);
    if (phrase) {
      bannedHit = { phrase, sample: text.slice(0, 120) };
      break;
    }
  }

  pushCheck(
    checks,
    'banned_phrases_absent',
    bannedHit === null,
    bannedHit
      ? `Banned phrase "${bannedHit.phrase}" detected in: ${bannedHit.sample}`
      : 'No banned phrases detected in regulator-readable copy.',
  );

  let bareVerifiedHit: string | null = null;
  for (const text of regulatorText) {
    if (containsBareVerifiedStatus(text)) {
      bareVerifiedHit = text.slice(0, 120);
      break;
    }
  }
  pushCheck(
    checks,
    'no_bare_verified_status_label',
    bareVerifiedHit === null,
    bareVerifiedHit
      ? `Bare "Verified" status label detected in: ${bareVerifiedHit}`
      : 'No bare "Verified" status label used.',
  );
}

function checkWindow(checks: NcqaValidationCheck[]): void {
  pushCheck(
    checks,
    'ncqa_window_120_days',
    NCQA_PSV_WINDOW === 120,
    `NCQA_PSV_WINDOW = ${NCQA_PSV_WINDOW}`,
  );
}

function checkDeterminism(checks: NcqaValidationCheck[]): void {
  const a = buildNcqaExportManifest(fixtureManifestInput());
  const b = buildNcqaExportManifest(fixtureManifestInput());
  pushCheck(
    checks,
    'manifest_deterministic_across_builds',
    a.manifestHash === b.manifestHash,
    a.manifestHash === b.manifestHash
      ? `manifestHash stable: ${a.manifestHash.slice(0, 16)}...`
      : `manifestHash drift: ${a.manifestHash.slice(0, 16)}... vs ${b.manifestHash.slice(0, 16)}...`,
  );
}

function checkTamperDetected(checks: NcqaValidationCheck[]): void {
  const verdict = runNcqaManifestChaos('TAMPER_EVIDENCE_HASH', fixtureManifestInput());
  pushCheck(
    checks,
    'tamper_surfaces_via_manifest_hash_change',
    verdict.signalSurfaced,
    verdict.signal,
  );
}

function checkOutOfWindowFlagged(checks: NcqaValidationCheck[]): void {
  const verdict = runNcqaManifestChaos(
    'BACKDATE_RETRIEVAL_OUTSIDE_WINDOW',
    fixtureManifestInput(),
  );
  pushCheck(
    checks,
    'out_of_window_retrieval_flagged',
    verdict.signalSurfaced,
    verdict.signal,
  );
}

function checkTraceabilityCoverage(checks: NcqaValidationCheck[]): void {
  // Every known event type should map to at least one standard. The catch-all
  // AMBIGUOUS_NOT_MAPPED is allowed but should never be the ONLY mapping
  // returned for the explicit event types we listed above.
  const fallbackOnly: AuditEventType[] = [];
  for (const type of KNOWN_AUDIT_EVENT_TYPES) {
    const trace = mapAuditEventToStandards({ auditEventType: type });
    if (trace.standards.length === 0) {
      fallbackOnly.push(type);
      continue;
    }
    const onlyAmbiguous = trace.standards.every(
      (ref) => ref.standardId === 'AMBIGUOUS_NOT_MAPPED',
    );
    if (onlyAmbiguous) fallbackOnly.push(type);
  }
  pushCheck(
    checks,
    'traceability_covers_known_event_types',
    fallbackOnly.length === 0,
    fallbackOnly.length === 0
      ? `All ${KNOWN_AUDIT_EVENT_TYPES.length} known event types map to at least one specific standard.`
      : `Event types fell through to AMBIGUOUS_NOT_MAPPED only: ${fallbackOnly.join(', ')}`,
  );
}

function checkCompletenessSemantics(checks: NcqaValidationCheck[]): void {
  const complete = buildNcqaExportManifest(fixtureManifestInput());
  const minimalInput = fixtureManifestInput();
  minimalInput.sources = [];
  minimalInput.decisions = [];
  minimalInput.overrides = [];
  const minimal = buildNcqaExportManifest(minimalInput);

  pushCheck(
    checks,
    'fixture_manifest_completeness_holds',
    isNcqaExportManifestComplete(complete),
    `Fixture manifest reports complete=${isNcqaExportManifestComplete(complete)}`,
  );
  pushCheck(
    checks,
    'empty_manifest_completeness_false',
    !isNcqaExportManifestComplete(minimal),
    `Empty manifest reports complete=${isNcqaExportManifestComplete(minimal)}`,
  );
}

export function runNcqaValidationGate(): NcqaValidationVerdict {
  const checks: NcqaValidationCheck[] = [];
  checkWindow(checks);
  checkDeterminism(checks);
  checkTamperDetected(checks);
  checkOutOfWindowFlagged(checks);
  checkTraceabilityCoverage(checks);
  checkBannedStrings(checks);
  checkCompletenessSemantics(checks);

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return {
    ok: failed === 0,
    passed,
    failed,
    checks,
  };
}

export const NCQA_VALIDATION_BANNED_PHRASES = BANNED_PHRASES;
export const NCQA_VALIDATION_KNOWN_EVENT_TYPES = KNOWN_AUDIT_EVENT_TYPES;
export const NCQA_VALIDATION_BARE_VERIFIED_LABEL = BARE_VERIFIED_LABEL;
