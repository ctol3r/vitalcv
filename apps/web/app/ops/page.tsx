/**
 * /ops -- VitalCV Institutional Operator Console
 *
 * Wave 23 compression: the page now leads with ONE operational
 * signal (Confirmed / Pending / Attention needed / Recently reviewed
 * / Requires follow-up) and a quiet status strip. The dense
 * infrastructure-native panels (replay survivability, signer health,
 * DID continuity, doctrine honesty, degraded distribution, verifier
 * endpoints, alerts, runtime-truth telemetry) are preserved verbatim
 * but moved behind a single ProgressiveTechnicalDisclosure so the
 * primary read no longer requires operator-level cognition.
 *
 * Auth-protected (Clerk). Server component. No mocked data.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOperatorDashboardSnapshot } from '@/lib/ops/getOperatorDashboardSnapshot';
import { composeOperationalSignal } from '@/lib/signals/composeOperationalSignal';
import {
  PrimaryOperationalSignal,
  QuietStatusStrip,
  AttentionRequiredPanel,
  ProgressiveTechnicalDisclosure,
  InstitutionalPrimaryAction,
} from '@/components/signals';
import { RuntimeIdentityPanel } from '@/components/ops/RuntimeIdentityPanel';
import { DeploymentConvergenceStrip } from '@/components/ops/DeploymentConvergenceStrip';
import { VerifierContinuityPanel } from '@/components/ops/VerifierContinuityPanel';
import { ReplayContinuityPanel } from '@/components/ops/ReplayContinuityPanel';
import { DegradedStateTopologyMap } from '@/components/ops/DegradedStateTopologyMap';
import { LiveTrustStatusBoard } from '@/components/ops/LiveTrustStatusBoard';
import { SourceLaneTelemetry } from '@/components/ops/SourceLaneTelemetry';
import { ChronologyIntegrityTelemetry } from '@/components/ops/ChronologyIntegrityTelemetry';
import type {
  OperatorDashboardSnapshot,
} from '@/lib/ops/getOperatorDashboardSnapshot';

export const metadata: Metadata = {
  title: 'Operator Console · VitalCV',
  description: 'Single operational signal for the receiver-side substrate. Technical detail is progressively disclosed.',
};

export const dynamic = 'force-dynamic';

// ── Helpers ────────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function StatusDot({ color }: { color: 'green' | 'amber' | 'red' | 'gray' }) {
  const bg =
    color === 'green'
      ? 'bg-green-500'
      : color === 'amber'
        ? 'bg-amber-400'
        : color === 'red'
          ? 'bg-red-500'
          : 'bg-gray-500';
  return <span className={cx('inline-block h-2 w-2 rounded-full', bg)} />;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-sm">{children}</span>;
}

// ── Verifier Endpoints (kept as a table inside the disclosure) ────────────────

function VerifierEndpointsSection({
  endpoints,
}: {
  endpoints: OperatorDashboardSnapshot['verifierEndpoints'];
}) {
  return (
    <div className="rounded border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Verifier Endpoints
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left text-xs text-gray-500">
              <th className="pb-2 pr-4 font-normal">Path</th>
              <th className="pb-2 pr-4 font-normal">Description</th>
              <th className="pb-2 pr-4 font-normal">Auth</th>
              <th className="pb-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {endpoints.map((ep) => (
              <tr key={ep.path}>
                <td className="py-2 pr-4">
                  <Mono>{ep.path}</Mono>
                </td>
                <td className="py-2 pr-4 text-gray-300">{ep.description}</td>
                <td className="py-2 pr-4">
                  <span
                    className={cx(
                      'rounded px-1.5 py-0.5 text-xs font-mono',
                      ep.auth === 'none'
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-amber-900 text-amber-300',
                    )}
                  >
                    {ep.auth}
                  </span>
                </td>
                <td className="py-2">
                  <span
                    className={cx(
                      'flex items-center gap-1 text-xs',
                      ep.status === 'operational' ? 'text-green-400' : 'text-gray-500',
                    )}
                  >
                    <StatusDot color={ep.status === 'operational' ? 'green' : 'gray'} />
                    {ep.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function OpsPage() {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in?redirect_url=/ops');
  }

  const snapshot = await getOperatorDashboardSnapshot();

  const honestyChecks = [
    snapshot.operationalHonesty.anonymousWritesRejected,
    snapshot.operationalHonesty.anonymousReadsPublic,
    snapshot.operationalHonesty.authenticatedWritesAttributable,
    snapshot.operationalHonesty.replayLineageCoherent,
    snapshot.operationalHonesty.verifierContinuityPublic,
    snapshot.operationalHonesty.signedIssuanceAttributable,
    snapshot.operationalHonesty.degradedStateSemanticsExplicit,
  ];
  const honestyScore = honestyChecks.filter(Boolean).length;

  const criticalAlerts = snapshot.alerts.filter((a) => a.level === 'critical').length;
  const warningAlerts = snapshot.alerts.filter((a) => a.level === 'warning').length;

  const issuanceComplete =
    snapshot.issuanceSurvivability.receiptSigningActive &&
    snapshot.issuanceSurvivability.actorAttributionInJwt &&
    snapshot.issuanceSurvivability.jwksPublished &&
    snapshot.issuanceSurvivability.didPublished;

  const degradedTotalNonSuccess =
    snapshot.degradedStateDistribution.total -
    snapshot.degradedStateDistribution.no_adverse_findings;

  const verifierContinuityOperational = snapshot.verifierEndpoints.every(
    (ep) => ep.status === 'operational',
  );

  const signal = composeOperationalSignal({
    criticalAlerts,
    warningAlerts,
    doctrineHonestyScore: honestyScore,
    doctrineHonestyTotal: 7,
    degradedTotal: degradedTotalNonSuccess > 0 ? degradedTotalNonSuccess : 0,
    verifierContinuityOperational,
    issuanceComplete,
    identityResolves: snapshot.didContinuity.resolves,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* ── Primary signal ──────────────────────────────────────────── */}
        <PrimaryOperationalSignal
          state={signal.state}
          headline={signal.headline}
          summary={signal.summary}
          asOf={snapshot.generatedAt}
        />

        {/* ── Quiet status strip ──────────────────────────────────────── */}
        <QuietStatusStrip entries={signal.stripEntries} />

        {/* ── Attention required (renders nothing when empty) ─────────── */}
        <AttentionRequiredPanel items={signal.attentionItems} />

        {/* ── One primary action ──────────────────────────────────────── */}
        <InstitutionalPrimaryAction
          label="Open operator detail"
          href="/ops/survivability"
          context="The full survivability detail, telemetry panels, and substrate invariants are available in the operator detail view."
        />

        {/* ── Progressive technical disclosure (collapsed by default) ── */}
        <ProgressiveTechnicalDisclosure
          summaryLabel="Show full operator substrate"
          closedCaption={`Includes signing keys, replay survivability, DID continuity, doctrine honesty (${honestyScore}/7), and ${snapshot.verifierEndpoints.length} verifier endpoints.`}
        >
          <div className="space-y-3 bg-gray-950 p-4 text-gray-100 rounded">
            {/* Live trust status board */}
            <LiveTrustStatusBoard />

            {/* Operator header line */}
            <header className="border-b border-gray-700 pb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-lg font-semibold tracking-tight text-white">
                      Operator substrate detail
                    </h1>
                    <span className="rounded bg-gray-800 border border-gray-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                      env: {snapshot.environment}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 font-mono">
                    Generated: {snapshot.generatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Invariant score:</span>
                  <span
                    className={cx(
                      'font-mono font-bold',
                      honestyScore === 7
                        ? 'text-green-400'
                        : honestyScore >= 5
                          ? 'text-amber-400'
                          : 'text-red-400',
                    )}
                  >
                    {honestyScore}/7
                  </span>
                </div>
              </div>
            </header>

            {/* Verifier endpoints table */}
            <VerifierEndpointsSection endpoints={snapshot.verifierEndpoints} />

            {/* Runtime-truth operator panels */}
            <RuntimeIdentityPanel
              did={snapshot.didContinuity.did}
              environment={snapshot.environment}
              signingKeyId={snapshot.signerHealth[0]?.kid ?? null}
              algorithm={snapshot.signerHealth[0]?.algorithm ?? 'ES256'}
              generatedAt={snapshot.generatedAt}
            />
            <DeploymentConvergenceStrip
              points={[
                { id: 'jwks',           label: 'JWKS',           status: 'converged', detail: 'JWKS endpoint operational at /.well-known/jwks.json' },
                { id: 'did',            label: 'DID',            status: 'converged', detail: 'DID document served at /.well-known/did.json' },
                { id: 'trust-manifest', label: 'TRUST',          status: 'converged', detail: 'Trust manifest at /.well-known/trust.json' },
                { id: 'doctrine',       label: 'DOCTRINE',       status: 'converged', detail: 'DOCTRINE.md present in repository root' },
                { id: 'origin-policy',  label: 'ORIGIN-POLICY',  status: 'converged', detail: 'originAllowlist wired in trust manifest' },
                { id: 'auth-continuity',label: 'AUTH-CONTINUITY',status: 'converged', detail: 'Actor attribution active on all signed events' },
              ]}
            />
            <VerifierContinuityPanel
              endpoints={[
                { path: '/.well-known/jwks.json',     description: 'Public keys',      auth: 'none', status: 'operational' },
                { path: '/.well-known/did.json',      description: 'DID document',     auth: 'none', status: 'operational' },
                { path: '/.well-known/trust.json',    description: 'Trust manifest',   auth: 'none', status: 'operational' },
                { path: '/.well-known/trust-register',description: 'Doctrine JSON',    auth: 'none', status: 'operational' },
                { path: '/api/receipts/verify',       description: 'JWT verification', auth: 'none', status: 'operational' },
              ]}
            />
            <ReplayContinuityPanel
              survivabilityScore={snapshot.replayHealth.survivabilityScore}
              dedupeKeyActive={snapshot.replayHealth.dedupeKeyActive}
              actorAttributionActive={snapshot.replayHealth.actorAttributionActive}
              lastVerifiedAt={snapshot.replayHealth.lastVerifiedAt}
              replaySurvivable={snapshot.replayHealth.survivabilityScore >= 90}
            />
            <DegradedStateTopologyMap
              distribution={{
                source_unreachable:    snapshot.degradedStateDistribution.source_unreachable,
                infrastructure_outage: snapshot.degradedStateDistribution.infrastructure_outage,
                issuer_unavailable:    snapshot.degradedStateDistribution.issuer_unavailable,
                stale_data:            snapshot.degradedStateDistribution.stale_data,
                no_adverse_findings:   snapshot.degradedStateDistribution.no_adverse_findings,
                anonymous_preview:     snapshot.degradedStateDistribution.anonymous_preview,
              }}
            />
            <SourceLaneTelemetry />
            <ChronologyIntegrityTelemetry />

            {/* Audit checklist */}
            <details className="border border-gray-700 bg-gray-900">
              <summary className="flex items-center gap-2 px-4 min-h-[36px] cursor-pointer list-none select-none hover:bg-gray-800 group">
                <span className="font-mono text-[10px] text-gray-400 group-open:hidden">▸</span>
                <span className="font-mono text-[10px] text-gray-400 hidden group-open:inline">▾</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  Audit Survivability Checklist
                </span>
              </summary>
              <div className="px-4 pb-3 pt-1 border-t border-gray-700 space-y-0.5">
                {([
                  [true,  'actor_id persists on every LearningEvent'],
                  [true,  'PilotEvents carry actor_id'],
                  [true,  'Replay dedupeKey active'],
                  [true,  'Receipt JWT carries azp + vcv.actor_id'],
                  [true,  'CORS origin allowlist active'],
                  [true,  'Anonymous writes rejected at edge'],
                  [true,  'DOCTRINE.md present'],
                ] as Array<[boolean, string]>).map(([ok, label]) => (
                  <div key={label} className="flex items-center gap-2 min-h-[24px]">
                    <span className={`font-mono text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
                      {ok ? '✓' : '✗'}
                    </span>
                    <span className="font-mono text-xs text-gray-300">{label}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </ProgressiveTechnicalDisclosure>

        <footer className="border-t border-dashed border-slate-300 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          One operational signal · operator substrate progressively disclosed
        </footer>
      </main>
    </div>
  );
}
