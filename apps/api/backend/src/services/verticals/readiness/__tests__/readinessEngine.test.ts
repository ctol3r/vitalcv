import { buildReadinessSummary, computeReadiness } from '../readinessEngine';
import type { PsvArtifact } from '../../../psv-adapters/types';

function buildArtifact(overrides: Partial<PsvArtifact>): PsvArtifact {
  return {
    artifactId: overrides.artifactId ?? 'artifact-1',
    npi: overrides.npi ?? '1234567890',
    source: overrides.source ?? 'NPPES_API',
    sourceUrl: overrides.sourceUrl ?? 'https://example.test/source',
    endpointMetadata: overrides.endpointMetadata ?? {
      version: '1',
      retrievedAt: '2026-04-09T00:00:00.000Z',
      responseTimeMs: 10,
    },
    retrievalTimestampUtc: overrides.retrievalTimestampUtc ?? '2026-04-09T00:00:00.000Z',
    rawPayload: overrides.rawPayload ?? '{"stub":false}',
    checksum: overrides.checksum ?? 'checksum-1',
    rawChecksum: overrides.rawChecksum ?? 'raw-checksum-1',
    normalizedData: overrides.normalizedData ?? { status: overrides.status ?? 'ACTIVE' },
    methodologyVersion: overrides.methodologyVersion ?? '2026-04-09',
    verifierIdentity: overrides.verifierIdentity ?? 'unit-test',
    status: overrides.status ?? 'ACTIVE',
    licenseNumber: overrides.licenseNumber,
    state: overrides.state,
    expiresAt: overrides.expiresAt,
  };
}

describe('readiness engine evidence-first model', () => {
  test('pending never equals blocked', () => {
    const report = computeReadiness('1234567890', 'CA', 'RN', [
      buildArtifact({
        source: 'NPPES_API',
        status: 'ACTIVE',
        normalizedData: { providerName: 'Dr. Example' },
      }),
    ]);

    expect(report.overallStatus).toBe('PENDING_VERIFICATION');
    expect(report.blockers).toEqual([]);
    expect(report.summary.sanctions).toBe('checking');
    expect(report.summary.licensure).toBe('not yet verified');
    expect(report.summary.enrollment).toBe('checking');
  });

  test('no score if no verified claims', () => {
    const report = computeReadiness('1234567890', 'CA', 'RN', []);

    expect(report.readinessScore).toBeNull();
    expect(report.readiness_score).toBeNull();
    expect(report.claims).toEqual([]);
    expect(report.overallStatus).toBe('PENDING_VERIFICATION');
  });

  test('identity renders independently', () => {
    const report = computeReadiness('1234567890', 'CA', 'RN', [
      buildArtifact({
        source: 'NPPES_API',
        status: 'ACTIVE',
        normalizedData: { providerName: 'Dr. Example' },
      }),
    ]);

    expect(report.summary).toEqual({
      identity: 'verified',
      sanctions: 'checking',
      licensure: 'not yet verified',
      enrollment: 'checking',
    });
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'NPPES',
          verified: true,
          confidence: 'high',
        }),
      ]),
    );
  });

  test('buildReadinessSummary maps pending lanes into narrative copy', () => {
    expect(buildReadinessSummary([
      { id: 'identity', status: 'verified', claim: null, sourceCoverage: [] },
      { id: 'sanctions', status: 'pending', claim: null, sourceCoverage: [] },
      { id: 'licensure', status: 'pending', claim: null, sourceCoverage: [] },
      { id: 'enrollment', status: 'pending', claim: null, sourceCoverage: [] },
    ])).toEqual({
      identity: 'verified',
      sanctions: 'checking',
      licensure: 'not yet verified',
      enrollment: 'checking',
    });
  });
});
