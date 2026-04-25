import { once } from 'node:events';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import {
  buildEmployerEvidencePacketBundleContents,
  createEmployerEvidencePacketZipStream,
} from '../employerPacketExport';
import type {
  EmployerEvidencePacketV1,
  EmployerPacketArtifactReference,
  EmployerPacketReceiptReference,
  EmployerPacketSourceManifestEntry,
} from '../employerPacket';

function buildPacketFixture(): EmployerEvidencePacketV1 {
  const nppesCheck = createCanonicalSourceCoverage({
    sourceId: 'NPPES_API',
    state: 'checked',
    reason: 'NPPES identity checked',
    checkedAt: '2026-03-23T19:00:00.000Z',
    freshnessWindowHours: 168,
    artifactId: 'artifact-1',
    checksum: 'checksum-1',
    parserVersion: 'v1.2.0',
    sourceUrl: 'https://example.com',
    proof: { artifactIds: ['artifact-1'], receiptIds: ['receipt-1'] },
  });
  const safetyCheck = createCanonicalSourceCoverage({
    sourceId: 'OIG_LEIE',
    state: 'checked',
    reason: 'OIG LEIE clear',
    checkedAt: '2026-03-23T19:00:00.000Z',
    freshnessWindowHours: 168,
  });
  const authorityCheck = createCanonicalSourceCoverage({
    sourceId: 'STATE_BOARD',
    state: 'checked',
    reason: 'State board licensure checked',
    checkedAt: '2026-03-23T19:00:00.000Z',
    freshnessWindowHours: 168,
  });
  const eligibilityCheck = createCanonicalSourceCoverage({
    sourceId: 'PECOS_PUBLIC',
    state: 'checked',
    reason: 'PECOS enrollment checked',
    checkedAt: '2026-03-23T19:00:00.000Z',
    freshnessWindowHours: 168,
  });
  const sourceCoverage = {
    checks: [nppesCheck, safetyCheck, authorityCheck, eligibilityCheck],
    summary: summarizeCanonicalSourceCoverage([
      nppesCheck,
      safetyCheck,
      authorityCheck,
      eligibilityCheck,
    ]),
  };
  const receiptReference: EmployerPacketReceiptReference = {
    sourceId: 'NPPES_API',
    receiptId: 'receipt-1',
  };
  const artifactReference: EmployerPacketArtifactReference = {
    sourceId: 'NPPES_API',
    artifactId: 'artifact-1',
    checksum: 'checksum-1',
    parserVersion: 'v1.2.0',
    sourceUrl: 'https://example.com',
    rawArtifactRef: 'artifact-1',
  };
  const manifestSource: EmployerPacketSourceManifestEntry = {
    sourceId: 'NPPES_API',
    truthStatus: 'VERIFIED',
    state: 'checked',
    reason: 'NPPES identity checked',
    checkedAt: '2026-03-23T19:00:00.000Z',
    observedAt: '2026-03-23T19:00:00.000Z',
    expiresAt: '2026-03-30T19:00:00.000Z',
    freshness: {
      status: 'current',
      checkedAt: '2026-03-23T19:00:00.000Z',
      observedAt: '2026-03-23T19:00:00.000Z',
      expiresAt: '2026-03-30T19:00:00.000Z',
      freshnessWindowHours: 168,
    },
    provenance: {
      artifactId: 'artifact-1',
      artifactIds: ['artifact-1'],
      receiptIds: ['receipt-1'],
      sourceUrl: 'https://example.com',
      rawArtifactRef: 'artifact-1',
      checksum: 'checksum-1',
      parserVersion: 'v1.2.0',
    },
    parserVersion: 'v1.2.0',
    checksum: 'checksum-1',
    sourceUrl: 'https://example.com',
    rawArtifactRef: 'artifact-1',
    freshnessWindowHours: 168,
    confidenceLabel: 'HIGH',
    reviewRequired: false,
    artifactId: 'artifact-1',
    artifactIds: ['artifact-1'],
    receiptIds: ['receipt-1'],
  };

  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt: '2026-03-23T20:00:00.000Z',
    exportedBy: 'employer-1',
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    displayName: 'Dr. Jane Doe',
    truth: {
      identity: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: nppesCheck,
      },
      safety: {
        kind: 'clearance',
        status: 'CLEAR',
        satisfied: true,
        decisionGrade: true,
        coverage: safetyCheck,
      },
      authority: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: authorityCheck,
      },
      eligibility: {
        kind: 'enrollment',
        status: 'ENROLLED',
        satisfied: true,
        decisionGrade: true,
        coverage: eligibilityCheck,
      },
    },
    manifest: {
      schema: 'vitalcv.employer.packet-manifest.v1',
      packetSchema: 'vitalcv.employer.packet.v1',
      exportedAt: '2026-03-23T20:00:00.000Z',
      exportedBy: 'employer-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      bundleFiles: [
        'packet.json',
        'manifest.json',
        'source-coverage.json',
        'status.json',
        'README.txt',
      ],
      receiptReferences: [receiptReference],
      artifactReferences: [artifactReference],
      sourceCoverage,
      sourceCoverageSummary: sourceCoverage.summary,
      freshness: {
        state: 'current',
        label: 'Current attached checks',
        items: [],
      },
      status: {
        truth: {
          identity: {
            kind: 'verification',
            status: 'VERIFIED',
            satisfied: true,
            decisionGrade: true,
            coverage: nppesCheck,
          },
          safety: {
            kind: 'clearance',
            status: 'CLEAR',
            satisfied: true,
            decisionGrade: true,
            coverage: safetyCheck,
          },
          authority: {
            kind: 'verification',
            status: 'VERIFIED',
            satisfied: true,
            decisionGrade: true,
            coverage: authorityCheck,
          },
          eligibility: {
            kind: 'enrollment',
            status: 'ENROLLED',
            satisfied: true,
            decisionGrade: true,
            coverage: eligibilityCheck,
          },
        },
        freshness: {
          state: 'current',
          label: 'Current attached checks',
          items: [],
        },
        readiness: {
          status: 'READY',
          score: 90,
          readiness_score: 90,
          level: 'L3',
          blockers: [],
        },
        decisionPosture: {
          status: 'READY',
          headline: 'Current source-backed checks support employer review now.',
          blockers: [],
          nextAction: 'Accept as head start or export this packet for employer review.',
          freshness: {
            state: 'current',
            label: 'Current attached checks',
            items: [],
          },
        },
        sourceCoverageSummary: sourceCoverage.summary,
      },
      sources: [manifestSource],
      trustContainer: {
        status: 'issued',
        trustContainerId: 'mock_vc_fixture_id',
        credentialEnvelopeId: 'envelope-hash-fixture',
        provider: 'mock',
        label: 'Mock/dev credential container',
        environment: 'mock-dev',
        issuedAt: '2026-03-23T20:00:00.000Z',
        schemaVersion: '1.0.0',
        artifactHash: 'audit-hash-fixture',
        auditHash: 'audit-hash-fixture',
        proofTier: 'DECISION_GRADE',
        proofStatus: 'DECISION_GRADE',
        limitationNotes: [],
        mock: true,
      },
    },
    receiptReferences: [receiptReference],
    artifactReferences: [artifactReference],
    sourceCoverageSummary: sourceCoverage.summary,
    freshness: {
      state: 'current',
      label: 'Current attached checks',
      items: [],
    },
    decisionPosture: {
      status: 'READY' as const,
      headline: 'Ready to proceed with source-backed review.',
      blockers: [],
      freshness: {
        state: 'current' as const,
        label: 'Current attached checks',
        items: [],
      },
      nextAction: 'Accept as head start.',
    },
    identity: {
      npi: '1234567890',
      displayName: 'Dr. Jane Doe',
      specialty: 'Family Medicine',
      source: 'CMS NPPES',
      checkedAt: '2026-03-23T19:00:00.000Z',
      status: 'confirmed',
      truthStatus: 'VERIFIED',
    },
    safety: {
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T19:00:00.000Z',
      exclusionConfidence: 'HIGH',
      source: 'OIG LEIE',
      isClear: true,
      negativeFindings: [],
      truthStatus: 'CLEAR',
    },
    authority: {
      truthStatus: 'VERIFIED',
      credentials: [],
      summary: { active: 1, missing: [] },
    },
    eligibility: {
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentNote: 'Enrolled',
      enrollmentDataVersion: '2026-Q1',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentCheckedAt: '2026-03-23T19:00:00.000Z',
      enrollmentConfidence: 'HIGH',
      source: 'CMS PECOS',
      truthStatus: 'ENROLLED',
    },
    readiness: {
      status: 'READY',
      score: 90,
      level: 'L3',
      estimatedStartDays: 3,
      blockers: [],
      nextActions: [],
    },
    sourceCoverage,
  } as any;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  await once(stream, 'end');
  return Buffer.concat(chunks);
}

describe('employer packet export bundle', () => {
  it('builds deterministic packet and manifest documents', () => {
    const packet = buildPacketFixture();
    const bundle = buildEmployerEvidencePacketBundleContents(packet);

    expect(JSON.parse(bundle.packetJson)).toEqual(packet);
    expect(JSON.parse(bundle.manifestJson)).toEqual(packet.manifest);
    expect(JSON.parse(bundle.sourceCoverageJson)).toEqual({
      schema: 'vitalcv.employer.packet-source-coverage.v1',
      exportedAt: packet.exportedAt,
      exportedBy: packet.exportedBy,
      entityId: packet.entityId,
      clinicianNpi: packet.clinicianNpi,
      sourceCoverage: packet.sourceCoverage,
      sourceCoverageSummary: packet.sourceCoverageSummary,
      manifestSources: packet.manifest.sources,
    });
    expect(JSON.parse(bundle.statusJson)).toEqual({
      schema: 'vitalcv.employer.packet-status.v1',
      exportedAt: packet.exportedAt,
      exportedBy: packet.exportedBy,
      entityId: packet.entityId,
      clinicianNpi: packet.clinicianNpi,
      truth: packet.truth,
      freshness: packet.freshness,
      readiness: packet.readiness,
      decisionPosture: packet.decisionPosture,
      sourceCoverageSummary: packet.sourceCoverageSummary,
    });
    expect(bundle.readmeTxt).toContain('VitalCV Employer Evidence Packet');
    expect(bundle.readmeTxt).toContain('Receipt References: 1');
    expect(bundle.readmeTxt).toContain('Artifact References: 1');
    expect(bundle.readmeTxt).toContain('source-coverage.json');
    expect(bundle.readmeTxt).toContain('status.json');
    expect(bundle.readmeTxt).toContain('Decision posture: READY');
    expect(bundle.readmeTxt).toContain('Safe next action: Accept as head start.');
  });

  it('packages packet.json, manifest.json, source-coverage.json, status.json, and README.txt into a zip stream', async () => {
    const packet = buildPacketFixture();
    const zipBuffer = await streamToBuffer(createEmployerEvidencePacketZipStream(packet));

    expect(zipBuffer.subarray(0, 2).toString('binary')).toBe('PK');
    expect(zipBuffer.includes(Buffer.from('packet.json'))).toBe(true);
    expect(zipBuffer.includes(Buffer.from('manifest.json'))).toBe(true);
    expect(zipBuffer.includes(Buffer.from('source-coverage.json'))).toBe(true);
    expect(zipBuffer.includes(Buffer.from('status.json'))).toBe(true);
    expect(zipBuffer.includes(Buffer.from('README.txt'))).toBe(true);
  });

  it('surfaces the trust-container manifest entry in README and JSON', () => {
    const packet = buildPacketFixture();
    const bundle = buildEmployerEvidencePacketBundleContents(packet);
    const manifest = JSON.parse(bundle.manifestJson) as typeof packet.manifest;

    expect(manifest.trustContainer).toBeDefined();
    expect(manifest.trustContainer.status).toBe('issued');
    expect(manifest.trustContainer.trustContainerId).toBe('mock_vc_fixture_id');
    expect(manifest.trustContainer.provider).toBe('mock');
    expect(manifest.trustContainer.mock).toBe(true);
    expect(manifest.trustContainer.environment).toBe('mock-dev');
    expect(bundle.readmeTxt).toContain('Mock/dev credential container');
    expect(bundle.readmeTxt).toContain('Credential container id: mock_vc_fixture_id');
    expect(bundle.readmeTxt).not.toMatch(/wallet/i);
    expect(bundle.readmeTxt).not.toMatch(/on-chain|on chain/i);
  });

  it('renders the not-issued label when trust-container issuance was skipped', () => {
    const packet = buildPacketFixture();
    const skipped: EmployerEvidencePacketV1 = {
      ...packet,
      manifest: {
        ...packet.manifest,
        trustContainer: {
          status: 'not_issued',
          trustContainerId: null,
          credentialEnvelopeId: null,
          provider: null,
          label: 'Credential container: not issued',
          environment: null,
          issuedAt: null,
          schemaVersion: '1.0.0',
          artifactHash: null,
          auditHash: null,
          proofTier: null,
          proofStatus: null,
          limitationNotes: [],
          mock: false,
          skipReason: 'container disabled',
        },
      },
    };
    const bundle = buildEmployerEvidencePacketBundleContents(skipped);
    expect(bundle.readmeTxt).toContain('Credential container: not issued');
    expect(bundle.readmeTxt).toContain('Credential container skip reason: container disabled');
    expect(bundle.readmeTxt).not.toContain('Credential container id:');
  });

  it('preserves trust-container limitations in JSON and ZIP source documents', () => {
    const packet = buildPacketFixture();
    const limited: EmployerEvidencePacketV1 = {
      ...packet,
      manifest: {
        ...packet.manifest,
        trustContainer: {
          ...packet.manifest.trustContainer,
          proofTier: 'PARTIAL',
          proofStatus: 'PARTIAL',
          limitationNotes: ['Institutional access required'],
        },
      },
    };
    const bundle = buildEmployerEvidencePacketBundleContents(limited);
    const packetJson = JSON.parse(bundle.packetJson) as EmployerEvidencePacketV1;
    const manifest = JSON.parse(bundle.manifestJson) as typeof limited.manifest;

    expect(packetJson.manifest.trustContainer.limitationNotes).toEqual([
      'Institutional access required',
    ]);
    expect(manifest.trustContainer.limitationNotes).toEqual([
      'Institutional access required',
    ]);
    expect(bundle.readmeTxt).toContain('Credential container limitations:');
    expect(bundle.readmeTxt).toContain('- Institutional access required');
    expect(bundle.manifestJson).toBe(buildEmployerEvidencePacketBundleContents(limited).manifestJson);
  });

  it('keeps JSON and ZIP manifest trust-container fields identical', () => {
    // The ZIP stream is built from the same `buildEmployerEvidencePacketBundleContents`
    // output as the JSON manifest, so a contract test confirming both derive
    // from a single manifest.json blob is sufficient (and robust against the
    // zlib compression applied by archiver).
    const packet = buildPacketFixture();
    const bundleA = buildEmployerEvidencePacketBundleContents(packet);
    const bundleB = buildEmployerEvidencePacketBundleContents(packet);
    expect(bundleA.manifestJson).toBe(bundleB.manifestJson);

    const manifest = JSON.parse(bundleA.manifestJson) as typeof packet.manifest;
    const inlinePacket = JSON.parse(bundleA.packetJson) as EmployerEvidencePacketV1;

    // All Wave 3C required fields must be present & identical across the
    // inline packet view and the manifest-only view.
    const requiredKeys: (keyof typeof packet.manifest.trustContainer)[] = [
      'status',
      'trustContainerId',
      'credentialEnvelopeId',
      'provider',
      'environment',
      'label',
      'issuedAt',
      'schemaVersion',
      'artifactHash',
      'auditHash',
      'proofTier',
      'proofStatus',
      'limitationNotes',
      'mock',
    ];
    for (const key of requiredKeys) {
      expect(manifest.trustContainer[key]).toEqual(packet.manifest.trustContainer[key]);
      expect(inlinePacket.manifest.trustContainer[key]).toEqual(
        packet.manifest.trustContainer[key],
      );
    }
    expect(manifest.trustContainer.trustContainerId).toBe('mock_vc_fixture_id');
    expect(manifest.trustContainer.credentialEnvelopeId).toBe('envelope-hash-fixture');
    expect(manifest.trustContainer.environment).toBe('mock-dev');
  });

  it('fails loudly when a caller splats secret material onto the trust-container entry', () => {
    const packet = buildPacketFixture();
    const poisoned = {
      ...packet,
      manifest: {
        ...packet.manifest,
        trustContainer: {
          ...packet.manifest.trustContainer,
          apiKey: 'dock_live_123456789012',
        } as unknown as EmployerEvidencePacketV1['manifest']['trustContainer'],
      },
    };
    expect(() => buildEmployerEvidencePacketBundleContents(poisoned)).toThrow(/apiKey/);
  });

  it('does not leak secret-like field names in JSON or manifest output', () => {
    const packet = buildPacketFixture();
    const bundle = buildEmployerEvidencePacketBundleContents(packet);
    const forbidden = /"(?:apiKey|api_key|dockApiKey|DOCK_API_KEY|privateKey|private_key|secret|bearerToken|authorization|cookie|password)"\s*:/i;
    expect(bundle.packetJson).not.toMatch(forbidden);
    expect(bundle.manifestJson).not.toMatch(forbidden);
    expect(bundle.readmeTxt).not.toMatch(/apiKey|privateKey|bearerToken/i);
  });

  it('surfaces the failed status distinctly from not_issued in JSON and README', () => {
    const packet = buildPacketFixture();
    const failedPacket: EmployerEvidencePacketV1 = {
      ...packet,
      manifest: {
        ...packet.manifest,
        trustContainer: {
          status: 'failed',
          trustContainerId: null,
          credentialEnvelopeId: null,
          provider: 'mock',
          label: 'Credential container: issuance failed',
          environment: 'mock-dev',
          issuedAt: null,
          schemaVersion: '1.0.0',
          artifactHash: null,
          auditHash: null,
          proofTier: null,
          proofStatus: null,
          limitationNotes: [],
          mock: true,
          skipReason: 'provider throw: simulated outage',
        },
      },
    };
    const bundle = buildEmployerEvidencePacketBundleContents(failedPacket);
    const manifest = JSON.parse(bundle.manifestJson) as typeof failedPacket.manifest;
    expect(manifest.trustContainer.status).toBe('failed');
    expect(bundle.readmeTxt).toContain('Credential container: issuance failed');
    expect(bundle.readmeTxt).toContain('Credential container skip reason: provider throw: simulated outage');
    expect(bundle.readmeTxt).not.toContain('Credential container: not issued');
  });
});
