/**
 * regulatoryTraceability.ts — W2-PR40A
 *
 * Maps audit events, replay categories, and runtime trust classifications
 * onto regulatory framework references (NCQA Credentialing & Recredentialing,
 * URAC Health Plan, 42 CFR §455.106 exclusion screening) so a regulator can
 * read the audit trail in their own vocabulary.
 *
 * Design constraints:
 *   - Pure transform. No prisma. No fetches. No audit writes.
 *   - Ambiguity-preserving: when an event has no clear mapping we emit
 *     `AMBIGUOUS_NOT_MAPPED` rather than silently dropping it or guessing.
 *   - Regulator-readable: a `standardId` references a framework section.
 *     It is NOT a certification claim and MUST NOT be read as one.
 *   - Banned-string-safe per CLAUDE.md (no "automatically verified", no
 *     "complete credentialing", no bare "Verified" status label, etc.).
 */
import type { AuditEventType } from '../../../types/auditEventTypes';
import type {
  RuntimeReplayCategory,
  RuntimeMutationClassification,
} from '../../runtimeTrustCohesion';

export type RegulatoryFramework = 'NCQA' | 'URAC' | 'FED_42_CFR' | 'GENERAL';

export type RegulatoryStandardId =
  // NCQA Credentialing & Recredentialing (CR) — these IDs reference the
  // 2024 NCQA Health Plan Standards CR 3..8 sections. The IDs are stable
  // strings; consumers read them as references, never as certifications.
  | 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION'
  | 'NCQA_CR_3_LICENSURE_VERIFICATION'
  | 'NCQA_CR_3_DEA_REGISTRATION'
  | 'NCQA_CR_3_BOARD_CERTIFICATION'
  | 'NCQA_CR_3_EDUCATION_AND_TRAINING'
  | 'NCQA_CR_3_WORK_HISTORY'
  | 'NCQA_CR_3_MALPRACTICE_HISTORY'
  | 'NCQA_CR_4_APPLICATION_AND_ATTESTATION'
  | 'NCQA_CR_5_CREDENTIALING_COMMITTEE'
  | 'NCQA_CR_6_NOTIFICATION_TO_AUTHORITIES'
  | 'NCQA_CR_7_PRACTITIONER_RIGHTS'
  | 'NCQA_CR_8_DELEGATION_OF_CREDENTIALING'
  | 'NCQA_CR_120_DAY_TIMELINESS'
  // URAC Health Plan Credentialing
  | 'URAC_HP_CR_1_VERIFICATION_OF_CREDENTIALS'
  | 'URAC_HP_CR_4_CREDENTIALING_DECISION'
  // 42 CFR §455.106 — Federal exclusion screening
  | 'FED_42_CFR_455_106_EXCLUSION_SCREENING'
  // General audit-of-record retention
  | 'GENERAL_AUDIT_LOG_RETENTION'
  // Lossless catch-all. NEVER silently dropped.
  | 'AMBIGUOUS_NOT_MAPPED';

export interface RegulatoryStandardReference {
  standardId: RegulatoryStandardId;
  framework: RegulatoryFramework;
  /** Section identifier as published by the framework. */
  section: string;
  /** Short regulator-readable label (<= 80 chars). */
  label: string;
  /**
   * `DIRECT` — this event is direct evidence for the standard.
   * `CONTEXT` — this event is supporting context only and MUST NOT be read
   * as proof of compliance with the standard.
   */
  evidenceWeight: 'DIRECT' | 'CONTEXT';
}

const REGISTRY: Record<RegulatoryStandardId, RegulatoryStandardReference> = {
  NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION: {
    standardId: 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION',
    framework: 'NCQA',
    section: 'CR 3',
    label: 'Primary source verification of credentials',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_LICENSURE_VERIFICATION: {
    standardId: 'NCQA_CR_3_LICENSURE_VERIFICATION',
    framework: 'NCQA',
    section: 'CR 3, Element A',
    label: 'License to practice — primary source check',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_DEA_REGISTRATION: {
    standardId: 'NCQA_CR_3_DEA_REGISTRATION',
    framework: 'NCQA',
    section: 'CR 3, Element B',
    label: 'DEA / CDS registration check',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_BOARD_CERTIFICATION: {
    standardId: 'NCQA_CR_3_BOARD_CERTIFICATION',
    framework: 'NCQA',
    section: 'CR 3, Element C',
    label: 'Board certification — primary source check',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_EDUCATION_AND_TRAINING: {
    standardId: 'NCQA_CR_3_EDUCATION_AND_TRAINING',
    framework: 'NCQA',
    section: 'CR 3, Element D',
    label: 'Education and training verification',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_WORK_HISTORY: {
    standardId: 'NCQA_CR_3_WORK_HISTORY',
    framework: 'NCQA',
    section: 'CR 3, Element E',
    label: 'Work history collection',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_3_MALPRACTICE_HISTORY: {
    standardId: 'NCQA_CR_3_MALPRACTICE_HISTORY',
    framework: 'NCQA',
    section: 'CR 3, Element F',
    label: 'Malpractice claims history',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_4_APPLICATION_AND_ATTESTATION: {
    standardId: 'NCQA_CR_4_APPLICATION_AND_ATTESTATION',
    framework: 'NCQA',
    section: 'CR 4',
    label: 'Application and attestation by practitioner',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_5_CREDENTIALING_COMMITTEE: {
    standardId: 'NCQA_CR_5_CREDENTIALING_COMMITTEE',
    framework: 'NCQA',
    section: 'CR 5',
    label: 'Credentialing committee decision',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_6_NOTIFICATION_TO_AUTHORITIES: {
    standardId: 'NCQA_CR_6_NOTIFICATION_TO_AUTHORITIES',
    framework: 'NCQA',
    section: 'CR 6',
    label: 'Notification to authorities of adverse actions',
    evidenceWeight: 'DIRECT',
  },
  NCQA_CR_7_PRACTITIONER_RIGHTS: {
    standardId: 'NCQA_CR_7_PRACTITIONER_RIGHTS',
    framework: 'NCQA',
    section: 'CR 7',
    label: 'Practitioner rights — review and appeal',
    evidenceWeight: 'CONTEXT',
  },
  NCQA_CR_8_DELEGATION_OF_CREDENTIALING: {
    standardId: 'NCQA_CR_8_DELEGATION_OF_CREDENTIALING',
    framework: 'NCQA',
    section: 'CR 8',
    label: 'Delegation of credentialing activities',
    evidenceWeight: 'CONTEXT',
  },
  NCQA_CR_120_DAY_TIMELINESS: {
    standardId: 'NCQA_CR_120_DAY_TIMELINESS',
    framework: 'NCQA',
    section: 'CR 3 — timeliness',
    label: 'Primary source within 120 days of decision',
    evidenceWeight: 'DIRECT',
  },
  URAC_HP_CR_1_VERIFICATION_OF_CREDENTIALS: {
    standardId: 'URAC_HP_CR_1_VERIFICATION_OF_CREDENTIALS',
    framework: 'URAC',
    section: 'HP-CR 1',
    label: 'Verification of practitioner credentials',
    evidenceWeight: 'DIRECT',
  },
  URAC_HP_CR_4_CREDENTIALING_DECISION: {
    standardId: 'URAC_HP_CR_4_CREDENTIALING_DECISION',
    framework: 'URAC',
    section: 'HP-CR 4',
    label: 'Credentialing decision recorded',
    evidenceWeight: 'DIRECT',
  },
  FED_42_CFR_455_106_EXCLUSION_SCREENING: {
    standardId: 'FED_42_CFR_455_106_EXCLUSION_SCREENING',
    framework: 'FED_42_CFR',
    section: '42 CFR §455.106',
    label: 'Exclusion screening before participation',
    evidenceWeight: 'DIRECT',
  },
  GENERAL_AUDIT_LOG_RETENTION: {
    standardId: 'GENERAL_AUDIT_LOG_RETENTION',
    framework: 'GENERAL',
    section: 'Audit retention',
    label: 'Append-only audit-of-record entry',
    evidenceWeight: 'CONTEXT',
  },
  AMBIGUOUS_NOT_MAPPED: {
    standardId: 'AMBIGUOUS_NOT_MAPPED',
    framework: 'GENERAL',
    section: 'Unmapped',
    label: 'No regulator-readable mapping (preserved as-is)',
    evidenceWeight: 'CONTEXT',
  },
};

export function getRegulatoryStandard(id: RegulatoryStandardId): RegulatoryStandardReference {
  return REGISTRY[id];
}

export interface AuditEventTraceability {
  auditEventType: AuditEventType;
  replayCategory: RuntimeReplayCategory | null;
  mutationClassification: RuntimeMutationClassification | null;
  /** At least one entry. `AMBIGUOUS_NOT_MAPPED` when no specific mapping exists. */
  standards: RegulatoryStandardReference[];
  /** Regulator-readable explanation, plain English, <= 240 chars. */
  rationale: string;
}

const SOURCE_TO_NCQA_ELEMENT: Record<string, RegulatoryStandardId> = {
  NPPES: 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION',
  STATE_BOARD: 'NCQA_CR_3_LICENSURE_VERIFICATION',
  NURSYS: 'NCQA_CR_3_LICENSURE_VERIFICATION',
  DEA: 'NCQA_CR_3_DEA_REGISTRATION',
  ABIM: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABFM: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABEM: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABP: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABNS: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABOG: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ABS: 'NCQA_CR_3_BOARD_CERTIFICATION',
  BOARD_CERTIFICATION: 'NCQA_CR_3_BOARD_CERTIFICATION',
  ACGME: 'NCQA_CR_3_EDUCATION_AND_TRAINING',
  TRAINING_RECORD: 'NCQA_CR_3_EDUCATION_AND_TRAINING',
  OIG_LEIE: 'FED_42_CFR_455_106_EXCLUSION_SCREENING',
  OIG: 'FED_42_CFR_455_106_EXCLUSION_SCREENING',
  LEIE: 'FED_42_CFR_455_106_EXCLUSION_SCREENING',
};

function refsFor(...ids: RegulatoryStandardId[]): RegulatoryStandardReference[] {
  return ids.map((id) => REGISTRY[id]);
}

export function mapAuditEventToStandards(input: {
  auditEventType: AuditEventType;
  replayCategory?: RuntimeReplayCategory | null;
  mutationClassification?: RuntimeMutationClassification | null;
  source?: string | null;
}): AuditEventTraceability {
  const replayCategory = input.replayCategory ?? null;
  const mutationClassification = input.mutationClassification ?? null;

  switch (input.auditEventType) {
    case 'VERIFICATION_REQUESTED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION', 'GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'A primary source verification request opens an evidence-of-record entry under NCQA CR 3 and is retained as an append-only audit row.',
      };
    case 'VERIFICATION_COMPLETED': {
      const sourceKey = (input.source ?? '').toUpperCase();
      const elementId = SOURCE_TO_NCQA_ELEMENT[sourceKey];
      if (!elementId) {
        return {
          auditEventType: input.auditEventType,
          replayCategory,
          mutationClassification,
          standards: refsFor('NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION', 'AMBIGUOUS_NOT_MAPPED'),
          rationale: input.source
            ? `Primary source response captured. Source "${input.source}" has no specific CR 3 element mapping; preserved as-is.`
            : 'Primary source response captured. No source identifier supplied; preserved as-is for the regulator to interpret.',
        };
      }
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION',
          elementId,
          'NCQA_CR_120_DAY_TIMELINESS',
        ),
        rationale: `Primary source response from ${input.source} maps to NCQA CR 3 (${REGISTRY[elementId].label}) and the 120-day timeliness rule.`,
      };
    }
    case 'VERIFICATION_FAILED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION', 'GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'A failed primary source attempt is preserved as evidence under NCQA CR 3; the failure itself is part of the credentialing record.',
      };
    case 'EMPLOYER_REVIEW_ACCEPTED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'NCQA_CR_5_CREDENTIALING_COMMITTEE',
          'URAC_HP_CR_4_CREDENTIALING_DECISION',
        ),
        rationale:
          'Employer acceptance of a credentialing dossier is the operator-level analogue of an NCQA CR 5 committee decision and a URAC HP-CR 4 decision record.',
      };
    case 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'NCQA_CR_5_CREDENTIALING_COMMITTEE',
          'NCQA_CR_7_PRACTITIONER_RIGHTS',
        ),
        rationale:
          'Routing for manual review preserves the practitioner-rights pathway under NCQA CR 7 and feeds the CR 5 committee record.',
      };
    case 'EMPLOYER_REVIEW_REFRESH_REQUESTED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'NCQA_CR_120_DAY_TIMELINESS',
          'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION',
        ),
        rationale:
          'A refresh request indicates the operator believes the primary source data is past the NCQA 120-day window or otherwise stale.',
      };
    case 'EMPLOYER_REVIEW_MUTATION_DENIED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('NCQA_CR_7_PRACTITIONER_RIGHTS', 'GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'A denied operator mutation is preserved so a regulator can audit who attempted what, supporting NCQA CR 7 practitioner-rights review.',
      };
    case 'EMPLOYER_PACKET_SHARED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'NCQA_CR_8_DELEGATION_OF_CREDENTIALING',
          'GENERAL_AUDIT_LOG_RETENTION',
        ),
        rationale:
          'Packet sharing crosses an organizational boundary and is the operational signal a delegating entity tracks under NCQA CR 8.',
      };
    case 'BUNDLE_GENERATED':
    case 'ARTIFACT_EXPORTED':
    case 'ARTIFACT_VIEWED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'Artifact lifecycle events are retained as audit-of-record context. They are not direct CR 3 evidence by themselves.',
      };
    case 'RECOGNITION_EMITTED':
    case 'ACCEPTANCE_EMITTED':
    case 'START_EMITTED':
    case 'START_ATTESTED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor(
          'URAC_HP_CR_4_CREDENTIALING_DECISION',
          'GENERAL_AUDIT_LOG_RETENTION',
        ),
        rationale:
          'Trust-chain wedge events are operator-side decision signals and are preserved alongside the URAC HP-CR 4 decision record.',
      };
    case 'APPLICATION_MISSING_INFO_REQUESTED':
    case 'APPLICATION_MISSING_INFO_CLOSED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('NCQA_CR_4_APPLICATION_AND_ATTESTATION'),
        rationale:
          'Missing-information cycles map to the NCQA CR 4 application-and-attestation completeness requirement.',
      };
    case 'MONITORING_STATUS_CHANGE':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('NCQA_CR_6_NOTIFICATION_TO_AUTHORITIES'),
        rationale:
          'A monitored status change can trigger an adverse-action notification flow under NCQA CR 6.',
      };
    case 'TRUST_STATE_CHECK':
    case 'RATE_LIMIT_HIT':
    case 'API_ERROR':
    case 'VALIDATION_ERROR':
    case 'RESEARCH_PUBMED_FETCHED':
    case 'RESEARCH_ORCID_LINKED':
    case 'RESEARCH_ORCID_UNLINKED':
    case 'RESEARCH_TRIALS_FETCHED':
    case 'RESEARCH_SCORE_COMPUTED':
    case 'RESEARCH_DISCLOSURE_UPDATED':
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'Operational and research-layer events are retained as context for the audit-of-record but do not map to a specific credentialing standard.',
      };
    default:
      return {
        auditEventType: input.auditEventType,
        replayCategory,
        mutationClassification,
        standards: refsFor('AMBIGUOUS_NOT_MAPPED', 'GENERAL_AUDIT_LOG_RETENTION'),
        rationale:
          'Event type was not recognised by the traceability map. Preserved as-is so the regulator can interpret it.',
      };
  }
}
