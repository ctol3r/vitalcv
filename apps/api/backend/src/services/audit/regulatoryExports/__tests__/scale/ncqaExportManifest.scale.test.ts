/**
 * ncqaExportManifest scale gate (W2-PR40A)
 *
 * Asserts NCQA export manifests are deterministic, classify timeliness
 * correctly across the 120-day window boundary, and surface ambiguity
 * (missing retrievedAt, no decision timestamp, empty source list) in
 * `manifest.ambiguities` rather than silently producing a "complete"
 * manifest.
 */
import {
  buildNcqaExportManifest,
  isNcqaExportManifestComplete,
  NCQA_PSV_WINDOW,
  type BuildNcqaExportManifestInput,
} from '../../ncqaExportManifest';

function fixture(): BuildNcqaExportManifestInput {
  return {
    manifestId: 'manifest-fixture',
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    generatedAt: '2026-05-09T00:00:00.000Z',
    decisionTimestamp: '2026-05-01T12:00:00.000Z',
    sources: [
      {
        source: 'NPPES',
        evidenceHash: 'a'.repeat(64),
        retrievedAt: '2026-04-22T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-nppes',
      },
      {
        source: 'STATE_BOARD',
        evidenceHash: 'b'.repeat(64),
        retrievedAt: '2026-04-23T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-state',
      },
      {
        source: 'OIG_LEIE',
        evidenceHash: 'c'.repeat(64),
        retrievedAt: '2026-04-24T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-oig',
      },
      {
        source: 'BOARD_CERTIFICATION',
        evidenceHash: 'd'.repeat(64),
        retrievedAt: '2026-04-25T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-board',
      },
      {
        source: 'DEA',
        evidenceHash: 'e'.repeat(64),
        retrievedAt: '2026-04-26T12:00:00.000Z',
        outcome: 'VERIFIED',
        auditEventId: 'audit-dea',
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
        reason: 'Pilot deployment acceptance',
      },
    ],
  };
}

describe('ncqaExportManifest scale gate', () => {
  it('produces a deterministic manifestHash across two builds with identical input', () => {
    const a = buildNcqaExportManifest(fixture());
    const b = buildNcqaExportManifest(fixture());
    expect(a.manifestHash).toBe(b.manifestHash);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] ncqa-manifest-hash=${a.manifestHash.slice(0, 16)}...`);
  });

  it('flips manifestHash when an evidence hash is tampered', () => {
    const original = buildNcqaExportManifest(fixture());
    const mutated = fixture();
    mutated.sources[0].evidenceHash = 'f'.repeat(64);
    const tampered = buildNcqaExportManifest(mutated);
    expect(tampered.manifestHash).not.toBe(original.manifestHash);
  });

  it('classifies sources just inside and just outside the 120-day window correctly', () => {
    const decisionMs = Date.parse('2026-05-01T12:00:00.000Z');
    const insideMs = decisionMs - (NCQA_PSV_WINDOW - 1) * 24 * 60 * 60 * 1000;
    const outsideMs = decisionMs - (NCQA_PSV_WINDOW + 1) * 24 * 60 * 60 * 1000;
    const input = fixture();
    input.sources = [
      {
        source: 'NPPES',
        evidenceHash: 'a'.repeat(64),
        retrievedAt: new Date(insideMs).toISOString(),
        outcome: 'VERIFIED',
      },
      {
        source: 'STATE_BOARD',
        evidenceHash: 'b'.repeat(64),
        retrievedAt: new Date(outsideMs).toISOString(),
        outcome: 'EXPIRED',
      },
    ];
    const manifest = buildNcqaExportManifest(input);
    const sortedSources = [...manifest.sources].sort((a, b) => a.source.localeCompare(b.source));
    const npes = sortedSources.find((s) => s.source === 'NPPES');
    const stateBoard = sortedSources.find((s) => s.source === 'STATE_BOARD');
    expect(npes?.timeliness).toBe('WITHIN_120_DAYS');
    expect(stateBoard?.timeliness).toBe('OUTSIDE_120_DAYS');
  });

  it('preserves ambiguity when retrievedAt or decisionTimestamp is missing', () => {
    const input = fixture();
    input.decisionTimestamp = null;
    const manifest = buildNcqaExportManifest(input);
    expect(manifest.sources.every((s) => s.timeliness === 'AMBIGUOUS_DECISION_TIME_MISSING')).toBe(true);
    expect(manifest.ambiguities.some((n) => n.field === 'decisionTimestamp')).toBe(true);

    const input2 = fixture();
    const targetSourceName = input2.sources[0].source;
    input2.sources[0].retrievedAt = null;
    const manifest2 = buildNcqaExportManifest(input2);
    const targetSource = manifest2.sources.find((s) => s.source === targetSourceName);
    expect(targetSource?.timeliness).toBe('AMBIGUOUS_RETRIEVED_AT_MISSING');
    expect(manifest2.ambiguities.some((n) => n.field.includes('retrievedAt'))).toBe(true);
  });

  it('reports completeness only when CR 3, CR 5, and exclusion screening all have direct evidence', () => {
    const full = buildNcqaExportManifest(fixture());
    expect(isNcqaExportManifestComplete(full)).toBe(true);

    const noExclusion = fixture();
    noExclusion.sources = noExclusion.sources.filter((s) => s.source !== 'OIG_LEIE');
    expect(isNcqaExportManifestComplete(buildNcqaExportManifest(noExclusion))).toBe(false);

    const noCommitteeRecord = fixture();
    noCommitteeRecord.decisions = [];
    // EMPLOYER_REVIEW_ACCEPTED also feeds CR 5 as direct evidence — strip the
    // override too so we can verify the completeness check actually fails when
    // CR 5 has no direct entry from any source.
    noCommitteeRecord.overrides = [];
    expect(isNcqaExportManifestComplete(buildNcqaExportManifest(noCommitteeRecord))).toBe(false);

    const noCr3 = fixture();
    noCr3.sources = noCr3.sources.filter(
      (s) => !['NPPES', 'STATE_BOARD', 'BOARD_CERTIFICATION', 'DEA'].includes(s.source),
    );
    expect(isNcqaExportManifestComplete(buildNcqaExportManifest(noCr3))).toBe(false);
  });

  it('keeps zero-count NCQA sections in the section coverage so gaps are regulator-visible', () => {
    const input = fixture();
    input.sources = []; // strip everything
    input.decisions = [];
    input.overrides = [];
    const manifest = buildNcqaExportManifest(input);
    const cr7 = manifest.sectionCoverage.find(
      (row) => row.standard.standardId === 'NCQA_CR_7_PRACTITIONER_RIGHTS',
    );
    expect(cr7).toBeDefined();
    expect(cr7?.directEvidenceCount).toBe(0);
    expect(cr7?.contextEvidenceCount).toBe(0);
    expect(manifest.sectionCoverage.length).toBeGreaterThanOrEqual(15);
  });

  it('scales: 200 sources do not destabilise the manifestHash across re-runs', () => {
    const input = fixture();
    input.sources = Array.from({ length: 200 }, (_, i) => ({
      source: i % 2 === 0 ? 'NPPES' : 'STATE_BOARD',
      evidenceHash: i.toString(16).padStart(64, '0'),
      retrievedAt: new Date(Date.parse(input.decisionTimestamp ?? '2026-05-01T12:00:00.000Z') - i * 60 * 1000).toISOString(),
      outcome: 'VERIFIED',
      auditEventId: `audit-${i}`,
    }));
    const a = buildNcqaExportManifest(input);
    const b = buildNcqaExportManifest(input);
    expect(a.manifestHash).toBe(b.manifestHash);
    expect(a.sources.length).toBe(200);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] ncqa-200-sources hash=${a.manifestHash.slice(0, 16)}...`);
  });
});
