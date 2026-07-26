import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CLASSES,
  buildEvidenceCollection,
  isDecisionGradeStatus,
  summarizeEvidenceCoverage,
} from './collection';
import type { EvidenceObject } from './types';

function makeObject(overrides: Partial<EvidenceObject> = {}): EvidenceObject {
  const status = overrides.status ?? 'checked';
  return {
    evidenceId: overrides.evidenceId ?? 'ev-1',
    subjectKey: 'subject-1',
    evidenceClass: overrides.evidenceClass ?? 'identity',
    label: 'NPPES identity',
    value: null,
    status,
    source: { sourceId: 'NPPES_API', sourceLabel: 'NPPES', laneType: 'identity', governance: 'open' },
    trustTier: null,
    decisionGrade: overrides.decisionGrade ?? isDecisionGradeStatus(status),
    observedAt: null,
    checkedAt: null,
    expiresAt: null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active',
    supersedes: null,
    supersededBy: null,
    ...overrides,
  };
}

describe('isDecisionGradeStatus', () => {
  it('is true only for checked', () => {
    expect(isDecisionGradeStatus('checked')).toBe(true);
    for (const s of ['stale', 'pending', 'gated', 'unavailable', 'accessRequired', 'reviewRequired', 'notDecisionGrade', 'previewOnly'] as const) {
      expect(isDecisionGradeStatus(s)).toBe(false);
    }
  });
});

describe('buildEvidenceCollection', () => {
  it('groups by class and summarizes coverage', () => {
    const collection = buildEvidenceCollection({
      subjectKey: 'subject-1',
      generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
      objects: [
        makeObject({ evidenceId: 'a', evidenceClass: 'identity', status: 'checked' }),
        makeObject({ evidenceId: 'b', evidenceClass: 'licensure', status: 'gated', decisionGrade: false, source: { sourceId: 'STATE_BOARD', sourceLabel: 'State Board', laneType: 'licensure', governance: 'gated' } }),
      ],
    });
    expect(collection.byClass.identity).toHaveLength(1);
    expect(collection.byClass.licensure).toHaveLength(1);
    expect(collection.byClass.exclusion).toHaveLength(0);
    expect(collection.coverageSummary.checked).toContain('NPPES_API');
    expect(collection.coverageSummary.gated).toContain('STATE_BOARD');
    // every class key is present
    for (const cls of EVIDENCE_CLASSES) {
      expect(collection.byClass[cls]).toBeDefined();
    }
  });

  it('fails closed when decisionGrade contradicts status', () => {
    expect(() =>
      buildEvidenceCollection({
        subjectKey: 'subject-1',
        generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
        objects: [makeObject({ status: 'gated', decisionGrade: true })],
      }),
    ).toThrow(/decisionGrade invariant/);
  });
});

describe('summarizeEvidenceCoverage', () => {
  it('dedupes sourceIds per status bucket', () => {
    const summary = summarizeEvidenceCoverage([
      makeObject({ evidenceId: 'a', status: 'checked' }),
      makeObject({ evidenceId: 'b', status: 'checked' }),
    ]);
    expect(summary.checked).toEqual(['NPPES_API']);
  });
});
