/**
 * complianceChaos regulatory scale gate (W2-PR40A)
 *
 * Asserts every chaos scenario applicable to the regulatory-export pipeline
 * surfaces a regulator-visible signal — never silent corruption.
 *
 * Six scenarios MUST surface:
 *   - TAMPER_EVIDENCE_HASH               → manifestHash flips
 *   - TRUNCATE_SOURCES                    → coverage drops
 *   - BACKDATE_RETRIEVAL_OUTSIDE_WINDOW   → timeliness flips OUTSIDE_120_DAYS
 *   - STRIP_DECISION_LINEAGE              → CR 5 coverage drops + ambiguity note
 *   - INJECT_CROSS_TENANT_OVERRIDE        → filter rejects
 *   - DUPLICATE_OVERRIDE_REPLAY           → totalOverrides inflates
 */
import {
  runNcqaManifestChaos,
  runOverrideExportChaos,
  summarizeChaos,
  type ComplianceChaosScenario,
} from '../../complianceChaosSimulation';
import type { BuildNcqaExportManifestInput } from '../../ncqaExportManifest';
import type {
  BuildOverrideAuditExportInput,
  OverrideAuditInputEntry,
} from '../../overrideAuditExport';

function ncqaInput(): BuildNcqaExportManifestInput {
  return {
    manifestId: 'chaos-fixture',
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
      },
      {
        source: 'STATE_BOARD',
        evidenceHash: 'b'.repeat(64),
        retrievedAt: '2026-04-23T12:00:00.000Z',
        outcome: 'VERIFIED',
      },
      {
        source: 'OIG_LEIE',
        evidenceHash: 'c'.repeat(64),
        retrievedAt: '2026-04-24T12:00:00.000Z',
        outcome: 'VERIFIED',
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
    overrides: [],
  };
}

function overrideInput(): BuildOverrideAuditExportInput {
  const baseEntries: OverrideAuditInputEntry[] = [
    {
      auditEventId: 'a-1',
      auditEventType: 'EMPLOYER_REVIEW_ACCEPTED',
      occurredAt: '2026-05-01T10:00:00.000Z',
      actorId: 'user_employer_1',
      actorType: 'human',
      attributionSource: 'x-clerk-user-id',
      entityId: 'entity-A',
      clinicianNpi: '1234567890',
      reason: null,
      outcome: 'allowed',
      mutationClassification: 'TRUST_ACCEPTANCE',
      replayCategory: 'R-CAT-1',
      mutationFingerprint: 'a'.repeat(64),
      payloadHash: 'b'.repeat(64),
      correlationId: 'corr-1',
      attemptedByReadonly: false,
    },
    {
      auditEventId: 'a-2',
      auditEventType: 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
      occurredAt: '2026-05-02T10:00:00.000Z',
      actorId: 'user_employer_1',
      actorType: 'human',
      attributionSource: 'x-clerk-user-id',
      entityId: 'entity-A',
      clinicianNpi: '1234567890',
      reason: 'Source data is stale.',
      outcome: 'allowed',
      mutationClassification: 'TRUST_REFRESH_REQUEST',
      replayCategory: 'R-CAT-2',
      mutationFingerprint: 'c'.repeat(64),
      payloadHash: 'd'.repeat(64),
      correlationId: 'corr-2',
      attemptedByReadonly: false,
    },
  ];
  return {
    exportId: 'chaos-export',
    generatedAt: '2026-05-09T00:00:00.000Z',
    filter: { entityId: 'entity-A' },
    entries: baseEntries,
  };
}

describe('complianceChaos regulatory scale gate', () => {
  it.each<ComplianceChaosScenario>([
    'TAMPER_EVIDENCE_HASH',
    'TRUNCATE_SOURCES',
    'BACKDATE_RETRIEVAL_OUTSIDE_WINDOW',
    'STRIP_DECISION_LINEAGE',
  ])('NCQA manifest chaos scenario %s surfaces a regulator-visible signal', (scenario) => {
    const verdict = runNcqaManifestChaos(scenario, ncqaInput());
    expect(verdict.signalSurfaced).toBe(true);
  });

  it.each<ComplianceChaosScenario>([
    'INJECT_CROSS_TENANT_OVERRIDE',
    'DUPLICATE_OVERRIDE_REPLAY',
  ])('Override-export chaos scenario %s surfaces a regulator-visible signal', (scenario) => {
    const verdict = runOverrideExportChaos(scenario, overrideInput());
    expect(verdict.signalSurfaced).toBe(true);
  });

  it('aggregate chaos digest captures every scenario verdict', () => {
    const verdicts = [
      runNcqaManifestChaos('BASELINE', ncqaInput()),
      runNcqaManifestChaos('TAMPER_EVIDENCE_HASH', ncqaInput()),
      runNcqaManifestChaos('TRUNCATE_SOURCES', ncqaInput()),
      runNcqaManifestChaos('BACKDATE_RETRIEVAL_OUTSIDE_WINDOW', ncqaInput()),
      runNcqaManifestChaos('STRIP_DECISION_LINEAGE', ncqaInput()),
      runOverrideExportChaos('INJECT_CROSS_TENANT_OVERRIDE', overrideInput()),
      runOverrideExportChaos('DUPLICATE_OVERRIDE_REPLAY', overrideInput()),
    ];
    const summary = summarizeChaos(verdicts);
    expect(summary.totalScenarios).toBe(7);
    expect(summary.silentCount).toBe(0);
    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] compliance-chaos surfaced=${summary.surfacedCount}/${summary.totalScenarios} digest=${summary.digest.slice(0, 16)}...`,
    );
  });
});
