import {
  buildInstitutionalEvidenceExportManifest,
  evaluateEvidenceExportStandards,
  evaluateEvidenceExportStandardsGate,
  runEvidenceExportChaosSimulations,
  type InstitutionalEvidenceExportArtifact,
} from '../institutionalEvidenceExportStandards';

const EXPORT_ID = 'evidence-export-118a';
const GENERATED_AT = '2026-05-10T23:30:00.000Z';
const SOURCE_INSTITUTION_ID = 'institution-anchor-a';

function artifact(
  overrides: Partial<InstitutionalEvidenceExportArtifact> = {},
): InstitutionalEvidenceExportArtifact {
  return {
    artifactId: 'artifact-replay-manifest-1',
    artifactType: 'REPLAY_PORTABILITY_MANIFEST',
    producedAt: '2026-05-10T20:00:00.000Z',
    institutionId: SOURCE_INSTITUTION_ID,
    sourceSystemId: 'vitalcv-prod',
    targetSystemIds: ['payer-credentialing-suite', 'state-board-adapter'],
    schemaId: 'vitalcv.replay-portability-manifest',
    schemaVersion: '1.0.0',
    replayRefs: ['replay-envelope-1', 'decision-capsule-1'],
    auditEventRefs: ['audit-event-1', 'audit-event-2'],
    evidenceHashes: ['a'.repeat(64), 'b'.repeat(64)],
    lineageRefs: ['lineage-node-1', 'lineage-node-2'],
    adapterRefs: ['adapter-map-1'],
    portabilityApproved: true,
    compatibilityWeight: 0.92,
    ambiguity: null,
    ...overrides,
  };
}

function baselineArtifacts(): InstitutionalEvidenceExportArtifact[] {
  return [
    artifact(),
    artifact({
      artifactId: 'artifact-audit-reconstruction-1',
      artifactType: 'AUDIT_RECONSTRUCTION_EXPORT',
      producedAt: '2026-05-10T20:08:00.000Z',
      schemaId: 'vitalcv.audit-reconstruction-export',
      replayRefs: ['replay-envelope-2', 'decision-capsule-2'],
      auditEventRefs: ['audit-event-3', 'audit-event-4'],
      evidenceHashes: ['c'.repeat(64), 'd'.repeat(64)],
      lineageRefs: ['lineage-node-3', 'lineage-node-4'],
      compatibilityWeight: 0.9,
    }),
    artifact({
      artifactId: 'artifact-cross-org-adapter-1',
      artifactType: 'CROSS_ORG_EVIDENCE_ADAPTER',
      producedAt: '2026-05-10T20:16:00.000Z',
      schemaId: 'vitalcv.cross-org-evidence-adapter',
      replayRefs: ['replay-envelope-3'],
      auditEventRefs: ['audit-event-5', 'audit-event-6'],
      evidenceHashes: ['e'.repeat(64), 'f'.repeat(64)],
      lineageRefs: ['lineage-node-5', 'lineage-node-6'],
      adapterRefs: ['adapter-map-2', 'adapter-map-3'],
      compatibilityWeight: 0.88,
      ambiguity: 'State board adapter preserves unmapped local status vocabulary.',
    }),
    artifact({
      artifactId: 'artifact-lineage-snapshot-1',
      artifactType: 'LINEAGE_SNAPSHOT',
      producedAt: '2026-05-10T20:24:00.000Z',
      schemaId: 'vitalcv.audit-lineage-snapshot',
      replayRefs: ['replay-envelope-4'],
      auditEventRefs: ['audit-event-7', 'audit-event-8'],
      evidenceHashes: ['1'.repeat(64), '2'.repeat(64)],
      lineageRefs: ['lineage-node-7', 'lineage-node-8'],
      compatibilityWeight: 0.87,
    }),
  ];
}

describe('W2-PR118A institutional evidence export standards', () => {
  it('builds deterministic replay portability manifests from unordered export artifacts', () => {
    const baseline = baselineArtifacts();
    const manifest = buildInstitutionalEvidenceExportManifest({
      exportId: EXPORT_ID,
      generatedAt: GENERATED_AT,
      sourceInstitutionId: SOURCE_INSTITUTION_ID,
      artifacts: [...baseline].reverse(),
    });
    const repeat = buildInstitutionalEvidenceExportManifest({
      exportId: EXPORT_ID,
      generatedAt: GENERATED_AT,
      sourceInstitutionId: SOURCE_INSTITUTION_ID,
      artifacts: baseline,
    });

    expect(manifest.manifestHash).toBe(repeat.manifestHash);
    expect(manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.timeline.map((entry: { artifactId: string }) => entry.artifactId)).toEqual([
      'artifact-replay-manifest-1',
      'artifact-audit-reconstruction-1',
      'artifact-cross-org-adapter-1',
      'artifact-lineage-snapshot-1',
    ]);
    expect(manifest.firstProducedAt).toBe('2026-05-10T20:00:00.000Z');
    expect(manifest.lastProducedAt).toBe('2026-05-10T20:24:00.000Z');
    expect(manifest.targetSystemIds).toEqual(['payer-credentialing-suite', 'state-board-adapter']);
  });

  it('scores replay portability, audit reconstruction, export compatibility, and interoperability while preserving ambiguity', () => {
    const result = evaluateEvidenceExportStandards({
      exportId: EXPORT_ID,
      generatedAt: GENERATED_AT,
      sourceInstitutionId: SOURCE_INSTITUTION_ID,
      artifacts: baselineArtifacts(),
    });

    expect(result.status).toBe('EXPORT_DEGRADED');
    expect(result.verdict).toBe('EXPORT_INTEROPERABLE_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayPortability.reconstructable).toBe(true);
    expect(result.replayPortability.portabilityPct).toBeGreaterThanOrEqual(90);
    expect(result.auditReconstruction.reconstructable).toBe(true);
    expect(result.auditReconstruction.longitudinallyDurable).toBe(true);
    expect(result.interoperability.visible).toBe(true);
    expect(result.compatibility.score).toBeGreaterThanOrEqual(85);
    expect(result.ambiguities).toEqual([
      'State board adapter preserves unmapped local status vocabulary.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'exports_replay_reconstructable',
      'audit_lineage_longitudinally_durable',
      'institutional_interoperability_visible',
      'export_compatibility_scored',
      'ambiguity_preserved_in_exports',
    ]));
  });

  it('fails closed when exports are not replay-reconstructable, durable, portable, or interoperable', () => {
    const result = evaluateEvidenceExportStandards({
      exportId: EXPORT_ID,
      generatedAt: GENERATED_AT,
      sourceInstitutionId: SOURCE_INSTITUTION_ID,
      artifacts: [
        artifact({
          artifactId: 'artifact-broken-1',
          artifactType: 'REPLAY_PORTABILITY_MANIFEST',
          targetSystemIds: [],
          schemaVersion: '',
          replayRefs: [],
          auditEventRefs: [],
          evidenceHashes: [],
          lineageRefs: [],
          adapterRefs: [],
          portabilityApproved: false,
          compatibilityWeight: 0.2,
          ambiguity: 'External verifier supplied no stable replay envelope mapping.',
        }),
      ],
    });

    expect(result.status).toBe('EXPORT_BLOCKED');
    expect(result.verdict).toBe('EXPORT_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Replay portability manifest is not reconstructable.',
      'Audit reconstruction export is not durable.',
      'Export compatibility is below interoperability floor.',
      'Cross-system interoperability is not visible.',
    ]));
    expect(result.ambiguities).toEqual([
      'External verifier supplied no stable replay envelope mapping.',
    ]);

    const gate = evaluateEvidenceExportStandardsGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'exports_replay_reconstructable',
      'audit_lineage_longitudinally_durable',
      'fail_closed_export_semantics',
      'institutional_interoperability_visible',
    ]));
  });

  it('surfaces every evidence-export chaos scenario without silent normalization', () => {
    const chaos = runEvidenceExportChaosSimulations({
      exportId: EXPORT_ID,
      generatedAt: GENERATED_AT,
      sourceInstitutionId: SOURCE_INSTITUTION_ID,
      artifacts: baselineArtifacts(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(6);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_MANIFEST_GAP',
      'AMBIGUITY_SUPPRESSION',
      'AUDIT_LINEAGE_TRUNCATION',
      'CROSS_SYSTEM_ADAPTER_DRIFT',
      'COMPATIBILITY_SCHEMA_DRIFT',
      'EVIDENCE_HASH_REMOVAL',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
