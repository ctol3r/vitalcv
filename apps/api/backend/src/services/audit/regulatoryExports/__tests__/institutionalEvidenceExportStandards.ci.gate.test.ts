import {
  EVIDENCE_EXPORT_GATE_IDS,
  EVIDENCE_EXPORT_SENTINELS,
  evaluateEvidenceExportStandards,
  evaluateEvidenceExportStandardsGate,
  type InstitutionalEvidenceExportArtifact,
} from '../institutionalEvidenceExportStandards';

const artifacts: InstitutionalEvidenceExportArtifact[] = [
  {
    artifactId: 'ci-replay-manifest',
    artifactType: 'REPLAY_PORTABILITY_MANIFEST',
    producedAt: '2026-05-10T20:00:00.000Z',
    institutionId: 'ci-institution',
    sourceSystemId: 'vitalcv-prod',
    targetSystemIds: ['ci-verifier', 'ci-archive'],
    schemaId: 'vitalcv.replay-portability-manifest',
    schemaVersion: '1.0.0',
    replayRefs: ['ci-replay-1', 'ci-capsule-1'],
    auditEventRefs: ['ci-audit-1', 'ci-audit-2'],
    evidenceHashes: ['a'.repeat(64), 'b'.repeat(64)],
    lineageRefs: ['ci-lineage-1', 'ci-lineage-2'],
    adapterRefs: ['ci-adapter-1'],
    portabilityApproved: true,
    compatibilityWeight: 0.92,
    ambiguity: null,
  },
  {
    artifactId: 'ci-audit-reconstruction',
    artifactType: 'AUDIT_RECONSTRUCTION_EXPORT',
    producedAt: '2026-05-10T20:08:00.000Z',
    institutionId: 'ci-institution',
    sourceSystemId: 'vitalcv-prod',
    targetSystemIds: ['ci-verifier', 'ci-archive'],
    schemaId: 'vitalcv.audit-reconstruction-export',
    schemaVersion: '1.0.0',
    replayRefs: ['ci-replay-2', 'ci-capsule-2'],
    auditEventRefs: ['ci-audit-3', 'ci-audit-4'],
    evidenceHashes: ['c'.repeat(64), 'd'.repeat(64)],
    lineageRefs: ['ci-lineage-3', 'ci-lineage-4'],
    adapterRefs: ['ci-adapter-2'],
    portabilityApproved: true,
    compatibilityWeight: 0.9,
    ambiguity: 'Destination archive keeps local timestamp precision variance visible.',
  },
  {
    artifactId: 'ci-cross-org-adapter',
    artifactType: 'CROSS_ORG_EVIDENCE_ADAPTER',
    producedAt: '2026-05-10T20:16:00.000Z',
    institutionId: 'ci-institution',
    sourceSystemId: 'vitalcv-prod',
    targetSystemIds: ['ci-verifier', 'ci-archive'],
    schemaId: 'vitalcv.cross-org-evidence-adapter',
    schemaVersion: '1.0.0',
    replayRefs: ['ci-replay-3'],
    auditEventRefs: ['ci-audit-5', 'ci-audit-6'],
    evidenceHashes: ['e'.repeat(64), 'f'.repeat(64)],
    lineageRefs: ['ci-lineage-5', 'ci-lineage-6'],
    adapterRefs: ['ci-adapter-3'],
    portabilityApproved: true,
    compatibilityWeight: 0.88,
    ambiguity: null,
  },
  {
    artifactId: 'ci-lineage-snapshot',
    artifactType: 'LINEAGE_SNAPSHOT',
    producedAt: '2026-05-10T20:24:00.000Z',
    institutionId: 'ci-institution',
    sourceSystemId: 'vitalcv-prod',
    targetSystemIds: ['ci-verifier', 'ci-archive'],
    schemaId: 'vitalcv.audit-lineage-snapshot',
    schemaVersion: '1.0.0',
    replayRefs: ['ci-replay-4'],
    auditEventRefs: ['ci-audit-7', 'ci-audit-8'],
    evidenceHashes: ['1'.repeat(64), '2'.repeat(64)],
    lineageRefs: ['ci-lineage-7', 'ci-lineage-8'],
    adapterRefs: ['ci-adapter-4'],
    portabilityApproved: true,
    compatibilityWeight: 0.87,
    ambiguity: null,
  },
];

describe('CI gate - institutional evidence export standards', () => {
  it('keeps the evidence-export gate id surface explicit and frozen', () => {
    expect(EVIDENCE_EXPORT_GATE_IDS).toEqual([
      'exports_replay_reconstructable',
      'ambiguity_preserved_in_exports',
      'portability_measurable',
      'fail_closed_export_semantics',
      'audit_lineage_longitudinally_durable',
      'institutional_interoperability_visible',
      'export_compatibility_scored',
    ]);
    expect(Object.isFrozen(EVIDENCE_EXPORT_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(EVIDENCE_EXPORT_SENTINELS)).toBe(true);
  });

  it('passes only when replay, ambiguity, portability, lineage, interoperability, and compatibility gates hold', () => {
    const result = evaluateEvidenceExportStandards({
      exportId: 'ci-export',
      generatedAt: '2026-05-10T23:30:00.000Z',
      sourceInstitutionId: 'ci-institution',
      artifacts,
    });
    const gate = evaluateEvidenceExportStandardsGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateResult: { id: string }) => gateResult.id)).toEqual(EVIDENCE_EXPORT_GATE_IDS);
  });
});
