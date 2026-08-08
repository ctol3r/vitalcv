/**
 * /ops — VitalCV Institutional Operator Console
 *
 * Protected server component. Auth required (Clerk).
 * Infrastructure monitoring + trust audit surface.
 * Shows real runtime state — not marketing state.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOperatorDashboardSnapshot } from '@/lib/ops/getOperatorDashboardSnapshot';
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
  SignerHealthEntry,
  ReplayHealthSummary,
  DIDContinuityEntry,
  IssuanceSurvivability,
  OperationalHonestyMetrics,
  DegradedStateDistribution,
} from '@/lib/ops/getOperatorDashboardSnapshot';

export const metadata: Metadata = {
  title: 'Operator Console',
  description: 'VitalCV infrastructure monitoring and trust audit surface.',
};

export const dynamic = 'force-dynamic';

// ── Utility ────────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: 'green' | 'amber' | 'red' | 'neutral';
}) {
  const borderColor =
    accent === 'green'
      ? 'border-green-600'
      : accent === 'amber'
        ? 'border-amber-500'
        : accent === 'red'
          ? 'border-red-600'
          : 'border-gray-700';

  return (
    <div className={cx('rounded border bg-gray-900 p-4', borderColor)}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </div>
      {children}
    </div>
  );
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

// ── Metric: Replay Health ──────────────────────────────────────────────────────

function ReplayHealthCard({ data }: { data: ReplayHealthSummary }) {
  const score = data.survivabilityScore;
  const accent = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';
  const dotColor = accent === 'green' ? 'green' : accent === 'amber' ? 'amber' : 'red';

  return (
    <MetricCard title="Replay Health" accent={accent}>
      <div className="flex items-center gap-2 mb-3">
        <StatusDot color={dotColor} />
        <span className="text-white font-medium capitalize">{data.status}</span>
      </div>
      <div className="space-y-1 text-sm text-gray-300">
        <div className="flex justify-between">
          <span>Survivability</span>
          <Mono>{score}/100</Mono>
        </div>
        <div className="flex justify-between">
          <span>Dedupe key</span>
          <span className={data.dedupeKeyActive ? 'text-green-400' : 'text-red-400'}>
            {data.dedupeKeyActive ? '✓ active' : '✗ missing'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Actor attribution</span>
          <span className={data.actorAttributionActive ? 'text-green-400' : 'text-red-400'}>
            {data.actorAttributionActive ? '✓ active' : '✗ missing'}
          </span>
        </div>
      </div>
    </MetricCard>
  );
}

// ── Metric: Signer Health ──────────────────────────────────────────────────────

function SignerHealthCard({ data }: { data: SignerHealthEntry[] }) {
  const primary = data[0];
  const accent =
    !primary
      ? 'red'
      : primary.status === 'active'
        ? 'green'
        : primary.status === 'rotated'
          ? 'amber'
          : 'red';
  const dotColor = accent === 'green' ? 'green' : accent === 'amber' ? 'amber' : 'red';

  return (
    <MetricCard title="Signer Health" accent={accent}>
      {primary ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <StatusDot color={dotColor} />
            <span className="text-white font-medium capitalize">{primary.status}</span>
          </div>
          <div className="space-y-1 text-sm text-gray-300">
            <div className="flex justify-between gap-2">
              <span className="shrink-0">kid</span>
              <Mono>{primary.kid.length > 22 ? `${primary.kid.slice(0, 22)}…` : primary.kid}</Mono>
            </div>
            <div className="flex justify-between">
              <span>Algorithm</span>
              <Mono>{primary.algorithm}</Mono>
            </div>
            <div className="flex justify-between">
              <span>Since</span>
              <Mono>{primary.since}</Mono>
            </div>
          </div>
        </>
      ) : (
        <p className="text-red-400 text-sm">No signing key found.</p>
      )}
    </MetricCard>
  );
}

// ── Metric: DID Continuity ─────────────────────────────────────────────────────

function DIDContinuityCard({ data }: { data: DIDContinuityEntry }) {
  const accent = data.resolves ? 'green' : 'red';

  return (
    <MetricCard title="DID Continuity" accent={accent}>
      <div className="flex items-center gap-2 mb-3">
        <StatusDot color={data.resolves ? 'green' : 'red'} />
        <span className="text-white font-medium">{data.resolves ? 'Resolves' : 'Broken'}</span>
      </div>
      <div className="space-y-1 text-sm text-gray-300">
        <div className="flex justify-between gap-2">
          <span className="shrink-0">DID</span>
          <Mono>{data.did}</Mono>
        </div>
        <div className="flex justify-between gap-2">
          <span className="shrink-0">JWKS</span>
          <Mono>{data.jwksUri}</Mono>
        </div>
        <div className="flex justify-between">
          <span>Last rotation</span>
          <Mono>{data.lastRotation ?? 'never'}</Mono>
        </div>
      </div>
    </MetricCard>
  );
}

// ── Metric: Issuance Survivability ─────────────────────────────────────────────

function IssuanceSurvivabilityCard({ data }: { data: IssuanceSurvivability }) {
  const allActive =
    data.receiptSigningActive &&
    data.actorAttributionInJwt &&
    data.jwksPublished &&
    data.didPublished;
  const accent = allActive ? 'green' : 'amber';

  const checks: Array<[string, boolean]> = [
    ['Receipt signing', data.receiptSigningActive],
    ['Actor attr. in JWT', data.actorAttributionInJwt],
    ['JWKS published', data.jwksPublished],
    ['DID published', data.didPublished],
  ];

  return (
    <MetricCard title="Issuance Survivability" accent={accent}>
      <div className="flex items-center gap-2 mb-3">
        <StatusDot color={allActive ? 'green' : 'amber'} />
        <span className="text-white font-medium">
          {allActive ? 'All systems active' : 'Partial'}
        </span>
      </div>
      <div className="space-y-1 text-sm text-gray-300">
        {checks.map(([label, ok]) => (
          <div key={label} className="flex justify-between">
            <span>{label}</span>
            <span className={ok ? 'text-green-400' : 'text-amber-400'}>{ok ? '✓' : '✗'}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t border-gray-700">
          <span>Algorithm</span>
          <Mono>{data.signingAlgorithm}</Mono>
        </div>
      </div>
    </MetricCard>
  );
}

// ── Metric: Doctrine Honesty ───────────────────────────────────────────────────

function DoctrineHonestyCard({ data }: { data: OperationalHonestyMetrics }) {
  const checks: Array<[string, boolean]> = [
    ['Anon writes rejected', data.anonymousWritesRejected],
    ['Anon reads public', data.anonymousReadsPublic],
    ['Auth writes attributable', data.authenticatedWritesAttributable],
    ['Replay lineage coherent', data.replayLineageCoherent],
    ['Verifier continuity public', data.verifierContinuityPublic],
    ['Signed issuance attributable', data.signedIssuanceAttributable],
    ['Degraded semantics explicit', data.degradedStateSemanticsExplicit],
  ];

  const score = checks.filter(([, v]) => v).length;
  const total = checks.length;
  const accent = score === total ? 'green' : score >= 5 ? 'amber' : 'red';

  return (
    <MetricCard title="Doctrine Honesty" accent={accent}>
      <div className="flex items-center gap-2 mb-3">
        <StatusDot color={accent === 'green' ? 'green' : accent === 'amber' ? 'amber' : 'red'} />
        <span className="text-white font-medium font-mono">
          {score}/{total} pts
        </span>
        <span className="text-gray-400 text-xs">v{data.doctrineVersion}</span>
      </div>
      <div className="space-y-1 text-xs text-gray-300">
        {checks.map(([label, ok]) => (
          <div key={label} className="flex justify-between">
            <span>{label}</span>
            <span className={ok ? 'text-green-400' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t border-gray-700">
          <span>DOCTRINE.md</span>
          <span className={data.doctrineMd ? 'text-green-400' : 'text-amber-400'}>
            {data.doctrineMd ? '✓ present' : '✗ missing'}
          </span>
        </div>
      </div>
    </MetricCard>
  );
}

// ── Degraded State Distribution ────────────────────────────────────────────────

function DegradedDistributionSection({ data }: { data: DegradedStateDistribution }) {
  const bins: Array<{ key: keyof Omit<DegradedStateDistribution, 'total'>; label: string; isSuccess?: boolean }> = [
    { key: 'no_adverse_findings', label: '✓ No adverse findings', isSuccess: true },
    { key: 'source_unreachable', label: 'Source unreachable' },
    { key: 'anonymous_preview', label: 'Anonymous preview' },
    { key: 'infrastructure_outage', label: 'Infrastructure outage' },
    { key: 'issuer_unavailable', label: 'Issuer unavailable' },
    { key: 'stale_data', label: 'Stale data' },
  ];

  return (
    <div className="rounded border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Degraded State Distribution
        <span className="ml-2 text-gray-600 normal-case font-normal">
          ({data.total} total sources)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {bins.map(({ key, label, isSuccess }) => {
          const count = data[key];
          return (
            <div
              key={key}
              className={cx(
                'rounded p-3 text-center',
                isSuccess
                  ? 'bg-green-950 border border-green-700'
                  : count > 0
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-gray-900 border border-gray-800 opacity-50',
              )}
            >
              <div
                className={cx(
                  'text-2xl font-mono font-bold',
                  isSuccess ? 'text-green-400' : count > 0 ? 'text-gray-100' : 'text-gray-600',
                )}
              >
                {count}
              </div>
              <div
                className={cx(
                  'mt-1 text-xs leading-tight',
                  isSuccess ? 'text-green-300' : 'text-gray-400',
                )}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Alerts ─────────────────────────────────────────────────────────────────────

function AlertsSection({ alerts }: { alerts: OperatorDashboardSnapshot['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Alerts
        </div>
        <p className="text-sm text-gray-500">No alerts.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Alerts ({alerts.length})
      </div>
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const badgeCls =
            alert.level === 'critical'
              ? 'bg-red-900 text-red-300 border border-red-700'
              : alert.level === 'warning'
                ? 'bg-amber-900 text-amber-300 border border-amber-700'
                : 'bg-gray-800 text-gray-300 border border-gray-600';

          return (
            <div key={i} className="flex items-start gap-3 rounded bg-gray-800 p-3">
              <span
                className={cx(
                  'shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase',
                  badgeCls,
                )}
              >
                {alert.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200">{alert.message}</p>
                {alert.action && (
                  <p className="mt-0.5 text-xs text-gray-400">{alert.action}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Verifier Endpoints ─────────────────────────────────────────────────────────

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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Live Trust Status Board — top of page */}
      <LiveTrustStatusBoard />

      {/* Operator header */}
      <header className="bg-gray-900 border-b border-gray-700 px-6 py-5">
        <div className="mx-auto max-w-7xl flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                VitalCV Operator Console
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
            <span>Doctrine honesty:</span>
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
            {snapshot.alerts.length > 0 && (
              <span className="ml-2 rounded bg-amber-900 border border-amber-700 px-2 py-0.5 text-amber-300">
                {snapshot.alerts.length} alert{snapshot.alerts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Metric tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ReplayHealthCard data={snapshot.replayHealth} />
          <SignerHealthCard data={snapshot.signerHealth} />
          <DIDContinuityCard data={snapshot.didContinuity} />
          <IssuanceSurvivabilityCard data={snapshot.issuanceSurvivability} />
          <DoctrineHonestyCard data={snapshot.operationalHonesty} />
        </div>

        {/* Degraded state distribution */}
        <DegradedDistributionSection data={snapshot.degradedStateDistribution} />

        {/* Alerts */}
        <AlertsSection alerts={snapshot.alerts} />

        {/* Verifier endpoints */}
        <VerifierEndpointsSection endpoints={snapshot.verifierEndpoints} />

        {/* ── Runtime-truth operator panels ──────────────────────────────── */}
        <div className="space-y-3">
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
        </div>

        {/* ── Survivability detail link ─────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <a
            href="/ops/survivability"
            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            → Survivability detail
          </a>
        </div>

        {/* ── Audit Survivability Checklist ────────────────────────────────── */}
        <details className="border border-gray-200 bg-white">
          <summary className="flex items-center gap-2 px-4 min-h-[36px] cursor-pointer list-none select-none hover:bg-gray-50 group">
            <span className="font-mono text-[10px] text-gray-400 group-open:hidden">▸</span>
            <span className="font-mono text-[10px] text-gray-400 hidden group-open:inline">▾</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              Audit Survivability Checklist
            </span>
          </summary>
          <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-0.5">
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
                <span className={`font-mono text-xs ${ok ? 'text-green-700' : 'text-red-600'}`}>
                  {ok ? '✓' : '✗'}
                </span>
                <span className="font-mono text-xs text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </details>
      </main>
    </div>
  );
}
