/**
 * regulatoryTraceability scale gate (W2-PR40A)
 *
 * Asserts the traceability map covers every known AuditEventType, surfaces
 * the right NCQA section per primary-source identifier, and preserves
 * ambiguity rather than silently mapping unknown sources.
 */
import {
  getRegulatoryStandard,
  mapAuditEventToStandards,
  type RegulatoryStandardId,
} from '../../regulatoryTraceability';
import type { AuditEventType } from '../../../../../types/auditEventTypes';

const ALL_EVENT_TYPES: AuditEventType[] = [
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

describe('regulatoryTraceability scale gate', () => {
  it('maps every known audit event type to at least one standard reference and a non-empty rationale', () => {
    let totalMappings = 0;
    for (const type of ALL_EVENT_TYPES) {
      const trace = mapAuditEventToStandards({ auditEventType: type });
      expect(trace.standards.length).toBeGreaterThan(0);
      expect(trace.rationale.length).toBeGreaterThan(0);
      expect(trace.rationale.length).toBeLessThanOrEqual(280);
      totalMappings += trace.standards.length;
    }
    expect(totalMappings).toBeGreaterThan(ALL_EVENT_TYPES.length);
  });

  it('routes specific NCQA-relevant primary sources to their CR 3 element', () => {
    const cases: Array<{ source: string; expected: RegulatoryStandardId }> = [
      { source: 'NPPES', expected: 'NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION' },
      { source: 'STATE_BOARD', expected: 'NCQA_CR_3_LICENSURE_VERIFICATION' },
      { source: 'NURSYS', expected: 'NCQA_CR_3_LICENSURE_VERIFICATION' },
      { source: 'DEA', expected: 'NCQA_CR_3_DEA_REGISTRATION' },
      { source: 'ABIM', expected: 'NCQA_CR_3_BOARD_CERTIFICATION' },
      { source: 'BOARD_CERTIFICATION', expected: 'NCQA_CR_3_BOARD_CERTIFICATION' },
      { source: 'ACGME', expected: 'NCQA_CR_3_EDUCATION_AND_TRAINING' },
      { source: 'OIG_LEIE', expected: 'FED_42_CFR_455_106_EXCLUSION_SCREENING' },
    ];

    for (const c of cases) {
      const trace = mapAuditEventToStandards({
        auditEventType: 'VERIFICATION_COMPLETED',
        source: c.source,
      });
      const ids = trace.standards.map((s) => s.standardId);
      expect(ids).toContain(c.expected);
      // Every VERIFICATION_COMPLETED with a known source must also tag the
      // 120-day timeliness rule so timing is regulator-visible.
      expect(ids).toContain('NCQA_CR_120_DAY_TIMELINESS');
    }
  });

  it('preserves ambiguity for unknown sources rather than silently dropping them', () => {
    const trace = mapAuditEventToStandards({
      auditEventType: 'VERIFICATION_COMPLETED',
      source: 'WEIRD_NEW_SOURCE_NOT_REGISTERED',
    });
    const ids = trace.standards.map((s) => s.standardId);
    expect(ids).toContain('AMBIGUOUS_NOT_MAPPED');
    expect(ids).toContain('NCQA_CR_3_PRIMARY_SOURCE_VERIFICATION');
  });

  it('exposes registry entries for every standard the map can return', () => {
    const allReturnedIds = new Set<RegulatoryStandardId>();
    for (const type of ALL_EVENT_TYPES) {
      for (const ref of mapAuditEventToStandards({ auditEventType: type }).standards) {
        allReturnedIds.add(ref.standardId);
      }
    }
    for (const id of allReturnedIds) {
      expect(getRegulatoryStandard(id)).toBeDefined();
      expect(getRegulatoryStandard(id).standardId).toBe(id);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] regulatory-traceability-coverage standards=${allReturnedIds.size} events=${ALL_EVENT_TYPES.length}`,
    );
  });
});
