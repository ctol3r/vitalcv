import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.fn(() => {
  throw new Error('notFound');
});

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/ui/AnimatedTimeline', () => ({
  AnimatedTimeline: () => 'Timeline',
}));

vi.mock('@/components/passport/PassportShareActions', () => ({
  default: () => 'Share Actions',
}));

vi.mock('../app/p/[slug]/CopyShareLink', () => ({
  CopyShareLink: () => 'Copy share link',
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
    expect(markup).toContain('Shareable Proof Bundle');
    expect(markup).toContain('Monitoring Status');
    expect(markup).toContain('NURSYS');
    expect(markup).toContain('Apply with VitalCV');
    expect(markup).not.toContain('licenseNumber');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
  }, 15000);

  it('disables proof downloads when no source-backed claims are attached', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        npi: '1234567890',
        status: 'PENDING',
        trustBand: 'L1',
        readinessScore: 25,
        lastAnchored: null,
        activeCredentials: [],
        readiness: {
          evaluated: true,
          isEligible: false,
          missingRequirements: ['State licensure'],
          traceCount: 0,
        },
        artifactSummaries: [
          {
            artifactId: 'artifact-1',
            issuer: 'CMS NPPES',
            status: 'ACTIVE',
            lifecycleState: 'active',
            verifiedAt: '2026-03-02T00:00:00.000Z',
            expiresAt: null,
            monitoring: false,
            checksum: 'checksum-1234567890',
            claimCount: 0,
            claimHashes: [],
            selectiveDisclosure: null,
          },
        ],
        issuerProvenance: [],
        monitoringSummary: {
          monitoredArtifactCount: 0,
          totalArtifactCount: 1,
          coverageRate: 0,
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

    expect(markup).toContain('No source-backed claims are attached yet');
    expect(markup).toContain('JSON proof unavailable');
    expect(markup).toContain('PDF proof unavailable');
    expect(markup).not.toContain('Download JSON Proof');
    expect(markup).not.toContain('Download PDF Proof');
  }, 15000);

  it('renders empty-state employer action sections instead of hiding them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        npi: '1234567890',
        status: 'PENDING',
        trustBand: 'L1',
        readinessScore: 25,
        lastAnchored: null,
        activeCredentials: [],
        readiness: {
          evaluated: false,
          isEligible: null,
          missingRequirements: [],
          traceCount: 0,
        },
        artifactSummaries: [],
        issuerProvenance: [],
        monitoringSummary: {
          monitoredArtifactCount: 0,
          totalArtifactCount: 0,
          coverageRate: 0,
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

    expect(markup).toContain('How other employers have handled this clinician');
    expect(markup).toContain('Recent employer actions');
    expect(markup).toContain('No employer actions are recorded yet.');
  }, 15000);

  it('renders the latest confirmed action from persisted history', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        npi: '1234567890',
        status: 'PENDING',
        trustBand: 'L2',
        readinessScore: 68,
        lastAnchored: null,
        activeCredentials: [],
        readiness: {
          evaluated: true,
          isEligible: true,
          missingRequirements: [],
          traceCount: 1,
        },
        artifactSummaries: [],
        issuerProvenance: [],
        monitoringSummary: {
          monitoredArtifactCount: 0,
          totalArtifactCount: 0,
          coverageRate: 0,
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
        actions: {
          recent: [
            {
              id: 'action-1',
              npi: '1234567890',
              action: 'flag',
              rationale: 'Need board clarification before relying on this profile.',
              createdAt: '2026-03-03T15:45:00.000Z',
            },
          ],
        },
        reuse_signal: {
          accepted_count: 0,
          flagged_count: 1,
          request_data_count: 0,
          last_action: 'flag',
          last_action_at: '2026-03-03T15:45:00.000Z',
        },
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

    expect(markup).toContain('Latest confirmed action');
    expect(markup).toContain('Flagged for review');
    expect(markup).toContain('Need board clarification before relying on this profile.');
  }, 15000);
});
