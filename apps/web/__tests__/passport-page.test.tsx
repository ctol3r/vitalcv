import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.fn(() => {
  throw new Error('notFound');
});

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('@/components/ui/AnimatedTimeline', () => ({
  AnimatedTimeline: () => 'Timeline',
}));

vi.mock('@/components/passport/PassportShareActions', () => ({
  default: () => 'Share Actions',
}));

vi.mock('@/components/apply/ApplyWithVitalCV', () => ({
  ApplyWithVitalCV: () => 'Apply with VitalCV',
}));

describe('/p/[slug] public passport page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    notFoundMock.mockClear();
  });

  it('renders the redacted NPI passport with trust band, artifacts, monitoring, and proof details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        npi: '1234567890',
        status: 'CLEARED',
        trustBand: 'L3',
        readinessScore: 91,
        lastAnchored: '2026-03-03T00:00:00.000Z',
        activeCredentials: ['NURSYS'],
        readiness: {
          evaluated: true,
          isEligible: true,
          missingRequirements: [],
          traceCount: 1,
        },
        artifactSummaries: [
          {
            artifactId: 'artifact-1',
            issuer: 'NURSYS',
            status: 'ACTIVE',
            lifecycleState: 'active',
            verifiedAt: '2026-03-02T00:00:00.000Z',
            expiresAt: null,
            monitoring: true,
            checksum: 'checksum-1234567890',
            claimCount: 2,
            claimHashes: ['hash-1', 'hash-2'],
            selectiveDisclosure: {
              algorithm: 'SD-JWT',
              hashAlgorithm: 'sha-256',
              claimCount: 2,
            },
          },
        ],
        issuerProvenance: [
          {
            issuer: 'NURSYS',
            artifactCount: 1,
            latestVerifiedAt: '2026-03-02T00:00:00.000Z',
            monitored: true,
            statuses: ['ACTIVE'],
          },
        ],
        monitoringSummary: {
          monitoredArtifactCount: 1,
          totalArtifactCount: 1,
          coverageRate: 1,
          activeAlertCount: 0,
          latestAlertAt: null,
        },
        proof: {
          jsonUrl: '/api/trust-proof/1234567890',
          pdfUrl: '/api/trust-proof/1234567890?format=pdf',
          auditBundleJson: '/api/artifact/bundle/1234567890',
          auditBundleDownload: '/api/artifact/bundle/1234567890/download',
        },
        events: [],
        generatedAt: '2026-03-03T00:00:00.000Z',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { default: PassportPage } = await import('../app/p/[slug]/page');
    const element = await PassportPage({
      params: Promise.resolve({ slug: '1234567890' }),
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Clinician Trust Band');
    expect(markup).toContain('Shareable Verification Proof');
    expect(markup).toContain('Monitoring Status');
    expect(markup).toContain('NURSYS');
    expect(markup).toContain('Apply with VitalCV');
    expect(markup).not.toContain('licenseNumber');
  }, 15000);
});
