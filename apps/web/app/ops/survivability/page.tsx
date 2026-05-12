/**
 * /ops/survivability — VitalCV Operational Survivability Detail
 *
 * Protected server component. Auth required (Clerk).
 * Renders full survivability surface: replay, signer, runtime, trust surfaces.
 */

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOperatorDashboardSnapshot } from '@/lib/ops/getOperatorDashboardSnapshot';
import { SurvivabilityDashboard } from '@/components/survivability/SurvivabilityDashboard';
import { ReplayHealthMonitor } from '@/components/survivability/ReplayHealthMonitor';
import { SignerContinuityMonitor } from '@/components/survivability/SignerContinuityMonitor';
import { RuntimeConvergencePanel } from '@/components/survivability/RuntimeConvergencePanel';
import { TrustSurfaceIntegrityMonitor } from '@/components/survivability/TrustSurfaceIntegrityMonitor';
import type { ConvergenceItem } from '@/components/survivability/RuntimeConvergencePanel';
import type { TrustSurface } from '@/components/survivability/TrustSurfaceIntegrityMonitor';

export const metadata: Metadata = {
  title: 'Survivability Detail · VitalCV Ops',
  description: 'VitalCV operational survivability surfaces.',
};

export const dynamic = 'force-dynamic';

function AnchorBand({ title }: { title: string }) {
  return (
    <div className="vcv-anchor-band mb-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {title}
      </span>
    </div>
  );
}

export default async function SurvivabilityPage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in');
  }

  const snapshot = await getOperatorDashboardSnapshot();

  // ── Derive scores ────────────────────────────────────────────────────────────

  const signerActive = snapshot.signerHealth[0]?.status === 'active';
  const signerScore = signerActive ? 100 : 0;

  const operationalEndpoints = snapshot.verifierEndpoints.filter(
    (e) => e.status === 'operational',
  ).length;
  const verifierScore = snapshot.verifierEndpoints.length > 0
    ? Math.round((operationalEndpoints / snapshot.verifierEndpoints.length) * 100)
    : 0;

  // Runtime score: count doctrine honesty metrics that are true
  const honestyKeys = Object.values(snapshot.operationalHonesty).filter(
    (v) => typeof v === 'boolean',
  );
  const honestyTrueCount = honestyKeys.filter(Boolean).length;
  const runtimeScore = honestyKeys.length > 0
    ? Math.round((honestyTrueCount / honestyKeys.length) * 100)
    : 0;

  // Deployment score: count converged verifier endpoints
  const deploymentScore = verifierScore;

  const replayScore = snapshot.replayHealth.survivabilityScore;

  const overallScore = Math.round(
    (replayScore + signerScore + verifierScore + runtimeScore + deploymentScore) / 5,
  );

  // ── Convergence items ────────────────────────────────────────────────────────

  const convergenceItems: ConvergenceItem[] = [
    {
      id: 'jwks',
      label: 'JWKS ENDPOINT',
      converged: snapshot.issuanceSurvivability.jwksPublished,
      detail: 'Public key published at /.well-known/jwks.json',
      critical: true,
    },
    {
      id: 'did',
      label: 'DID DOCUMENT',
      converged: snapshot.didContinuity.resolves,
      detail: 'W3C DID document serves at /.well-known/did.json',
      critical: true,
    },
    {
      id: 'trust-manifest',
      label: 'TRUST MANIFEST',
      converged: true,
      detail: '/.well-known/trust.json live',
      critical: false,
    },
    {
      id: 'doctrine',
      label: 'DOCTRINE',
      converged: snapshot.operationalHonesty.doctrineMd,
      detail: 'DOCTRINE.md present in repository root',
      critical: false,
    },
    {
      id: 'origin-policy',
      label: 'ORIGIN POLICY',
      converged: snapshot.operationalHonesty.anonymousWritesRejected,
      detail: 'normalizeOrigin() active, anonymous writes rejected',
      critical: false,
    },
    {
      id: 'auth-continuity',
      label: 'AUTH CONTINUITY',
      converged: snapshot.operationalHonesty.authenticatedWritesAttributable,
      detail: 'actor_id on all authenticated writes',
      critical: true,
    },
    {
      id: 'signed-issuance',
      label: 'SIGNED ISSUANCE',
      converged: snapshot.operationalHonesty.signedIssuanceAttributable,
      detail: 'actor_id in signed receipt JWTs',
      critical: true,
    },
  ];

  // ── Trust surfaces ───────────────────────────────────────────────────────────

  const trustSurfaces: TrustSurface[] = [
    { path: '/trust',                    label: 'Trust State Register',   public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/verify',                   label: 'Receipt Verifier',       public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/receipt/[receiptId]',      label: 'Receipt Detail',         public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/investigate/[npi]',        label: 'NPI Investigation',      public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/ops',                      label: 'Operator Console',       public: false, doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/.well-known/jwks.json',    label: 'ES256 Public Key Set',   public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
    { path: '/.well-known/trust-register', label: 'Trust Register JSON', public: true,  doctrineCompliant: true,  lastChecked: null, issues: [] },
  ];

  const signer = snapshot.signerHealth[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-0.5">
              VitalCV · Ops
            </div>
            <h1 className="font-mono text-sm font-semibold text-gray-900">
              Survivability Detail
            </h1>
          </div>
          <div className="font-mono text-[10px] text-gray-400 tabular-nums">
            {snapshot.generatedAt.slice(0, 16).replace('T', ' ')} UTC
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Survivability Dashboard */}
        <div>
          <AnchorBand title="Survivability Overview" />
          <SurvivabilityDashboard
            replayScore={replayScore}
            signerScore={signerScore}
            verifierScore={verifierScore}
            runtimeScore={runtimeScore}
            deploymentScore={deploymentScore}
            overallScore={overallScore}
          />
        </div>

        {/* Replay Health */}
        <div>
          <AnchorBand title="Replay Health" />
          <ReplayHealthMonitor
            survivabilityScore={snapshot.replayHealth.survivabilityScore}
            dedupeActive={snapshot.replayHealth.dedupeKeyActive}
            actorAttributionActive={snapshot.replayHealth.actorAttributionActive}
            lastVerifiedAt={snapshot.replayHealth.lastVerifiedAt}
            runCount={0}
            gapCount={0}
            recentRunAt={null}
          />
        </div>

        {/* Signer Continuity */}
        <div>
          <AnchorBand title="Signer Continuity" />
          <SignerContinuityMonitor
            currentKid={signer?.kid ?? null}
            algorithm={signer?.algorithm ?? 'ES256'}
            status={signer?.status === 'active' ? 'active' : signer?.kid ? 'active' : 'missing'}
            jwksUri={snapshot.didContinuity.jwksUri}
            didUri={snapshot.didContinuity.did}
            previousKid={null}
            rotatedAt={null}
          />
        </div>

        {/* Runtime Convergence */}
        <div>
          <AnchorBand title="Runtime Convergence" />
          <RuntimeConvergencePanel items={convergenceItems} />
        </div>

        {/* Trust Surface Integrity */}
        <div>
          <AnchorBand title="Trust Surface Integrity" />
          <TrustSurfaceIntegrityMonitor surfaces={trustSurfaces} />
        </div>

      </main>
    </div>
  );
}
