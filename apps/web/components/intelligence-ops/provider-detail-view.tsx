'use client';

import Link from 'next/link';
import { useProvider } from '@/hooks/useIntelligenceDetail';
import type { ProviderDetailResponse } from '@/lib/intelligence/detail-types';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { BackLink, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, riskScoreColor, trustScoreColor, severityTone } from './primitives';
import { OperationsShell } from './shell';

export function ProviderDetailView({
  detail,
  backHref,
}: {
  detail: ProviderDetailResponse;
  backHref: string;
}) {
  const resource = useProvider(detail.provider.npi, { initialData: detail });
  const current = resource.data ?? detail;

  return (
    <OperationsShell
      activeHref="/providers"
      title={current.provider.fullName}
      description={`${current.provider.providerType ?? 'Provider'} profile for NPI ${current.provider.npi} with credential evidence, trust state, and related intelligence.`}
      breadcrumbs={[
        { label: 'Providers', href: backHref },
        { label: current.provider.npi },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Provider profile</p>
          <p title={formatAbsoluteTime(current.profile.generatedAt)}>Updated {formatRelativeTime(current.profile.generatedAt)}</p>
          <p>{current.provider.activeCredentialCount}/{current.provider.totalCredentialCount} active credentials</p>
        </div>
      )}
      actions={(
        <>
          <BackLink href={backHref} label="Back to providers" />
          <Link
            href={`/investigations?npi=${current.provider.npi}`}
            className="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Open investigation
          </Link>
        </>
      )}
      banner={resource.recovering && resource.error ? (
        <SurfaceBanner tone="warning">
          Refresh failed. Showing the last confirmed provider detail snapshot.
        </SurfaceBanner>
      ) : null}
    >
      {resource.error && !resource.data ? (
        <SurfaceErrorState
          title="Provider detail unavailable"
          description={resource.error}
          onRetry={resource.refresh}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={current.profile.status} tone={severityTone(current.profile.status)} />
              <OpsBadge label={current.profile.trustBand} tone="info" />
              <span className="font-mono text-sm text-slate-400">NPI {current.provider.npi}</span>
              {current.provider.credential ? <span className="text-sm text-slate-400">{current.provider.credential}</span> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk score</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${riskScoreColor(current.provider.riskScore)}`}>{current.provider.riskScore}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trust score</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${trustScoreColor(current.provider.trustScore)}`}>{current.provider.trustScore}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Findings</p>
                <p className="mt-2 text-3xl font-semibold text-white">{current.provider.findingCount}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active storylines</p>
                <p className="mt-2 text-3xl font-semibold text-white">{current.provider.activeStorylineCount}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Provider type {current.provider.providerType ?? 'Unknown'}</p>
              <p>Readiness score {current.profile.readinessScore}</p>
              <TimestampPair label="Last updated" value={current.profile.generatedAt} />
            </div>
            <div className="flex flex-wrap gap-2">
              {current.provider.specialties.length > 0 ? current.provider.specialties.map((specialty) => (
                <span key={specialty} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {specialty}
                </span>
              )) : (
                <p className="text-sm text-slate-400">No specialty metadata is available for this provider.</p>
              )}
            </div>
            {current.profile.readiness.evaluated ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-300">
                  {current.profile.readiness.isEligible
                    ? `Readiness evaluator passed after ${current.profile.readiness.traceCount} reasoning steps.`
                    : 'Readiness evaluator found gaps that still need resolution.'}
                </p>
                {current.profile.readiness.missingRequirements.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-slate-400">
                    {current.profile.readiness.missingRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Credentials</h2>
              <span className="text-sm text-slate-400">{current.credentials.length} public entries</span>
            </div>
            {current.credentials.length > 0 ? (
              <div className="space-y-3">
                {current.credentials.map((credential) => (
                  <div key={credential.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={credential.type.replace(/_/g, ' ')} />
                      <OpsBadge label={credential.status} tone={severityTone(credential.status)} />
                      <span className="text-sm text-slate-400">{credential.issuer}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{credential.name}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <TimestampPair label="Verified" value={credential.verifiedAt} />
                      <TimestampPair label="Expires" value={credential.expiresAt} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No public credential summaries are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Credential evidence</h2>
              <span className="text-sm text-slate-400">{current.profile.artifactSummaries.length} artifacts</span>
            </div>
            {current.profile.artifactSummaries.length > 0 ? (
              <div className="space-y-3">
                {current.profile.artifactSummaries.map((artifact) => (
                  <div key={artifact.artifactId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={artifact.issuer} />
                      <OpsBadge label={artifact.status} tone={severityTone(artifact.status)} />
                      <TimestampPair label="Verified" value={artifact.verifiedAt} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      <p>Lifecycle {artifact.lifecycleState}</p>
                      <p>Claims {artifact.claimCount}</p>
                      <p>Checksum {artifact.checksum.slice(0, 12)}…</p>
                      {artifact.selectiveDisclosure ? (
                        <p>{artifact.selectiveDisclosure.algorithm} selective disclosure ready</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No credential artifacts were returned for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Related intelligence</h2>
              <span className="text-sm text-slate-400">{current.findings.length + current.storylines.length + current.actions.length} linked records</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Findings</h3>
                  <EntityLink href={`/findings?provider=${encodeURIComponent(current.provider.npi)}`} label="Open list" />
                </div>
                {current.findings.length > 0 ? current.findings.map((finding) => (
                  <div key={finding.findingId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                      <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
                    </div>
                    <Link href={`/findings/${finding.findingId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-white transition hover:text-cyan-200">
                      {finding.title}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Updated" value={finding.updatedAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">No findings are linked to this provider.</p>}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Storylines</h3>
                  <EntityLink href={`/storylines?provider=${encodeURIComponent(current.provider.npi)}`} label="Open list" />
                </div>
                {current.storylines.length > 0 ? current.storylines.map((storyline) => (
                  <div key={storyline.storylineId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
                      <OpsBadge label={storyline.status} tone={severityTone(storyline.status)} />
                    </div>
                    <Link href={`/storylines/${storyline.storylineId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-white transition hover:text-cyan-200">
                      {storyline.title}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Activity" value={storyline.lastActivityAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">No storylines are linked to this provider.</p>}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</h3>
                {current.actions.length > 0 ? current.actions.map((action) => (
                  <div key={action.actionId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={action.priority} tone={severityTone(action.priority)} />
                      <OpsBadge label={action.status} tone={severityTone(action.status)} />
                    </div>
                    <Link href={`/actions/${action.actionId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-white transition hover:text-cyan-200">
                      {action.recommendedAction}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Created" value={action.createdAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">No actions are linked to this provider.</p>}
              </div>
            </div>
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Identifiers</h2>
            {current.provider.identifiers.length > 0 ? current.provider.identifiers.map((identifier) => (
              <div key={`${identifier.label}-${identifier.value}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{identifier.label}</p>
                <p className="mt-2 text-sm text-slate-200">{identifier.value}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-400">No identifiers are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Locations</h2>
            {current.provider.locations.length > 0 ? current.provider.locations.map((location) => (
              <div key={`${location.label}-${location.state ?? ''}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-200">{location.label}</p>
                {location.state ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{location.state}</p> : null}
              </div>
            )) : (
              <p className="text-sm text-slate-400">No practice locations are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Issuer provenance</h2>
            {current.profile.issuerProvenance.length > 0 ? current.profile.issuerProvenance.map((issuer) => (
              <div key={issuer.issuer} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={issuer.issuer} />
                  <span className="text-sm text-slate-400">{issuer.artifactCount} artifacts</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  <span title={formatAbsoluteTime(issuer.latestVerifiedAt)}>
                    Last verified {formatRelativeTime(issuer.latestVerifiedAt)}
                  </span>
                  {' · '}
                  statuses {issuer.statuses.join(', ')}
                </p>
              </div>
            )) : <p className="text-sm text-slate-400">No issuer provenance records are available.</p>}
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Monitoring summary</h2>
            <p className="text-sm text-slate-300">
              {current.profile.monitoringSummary.monitoredArtifactCount}/{current.profile.monitoringSummary.totalArtifactCount} artifacts monitored
            </p>
            <p className="text-sm text-slate-300">
              Coverage {(current.profile.monitoringSummary.coverageRate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-slate-300">
              Active alerts {current.profile.monitoringSummary.activeAlertCount}
            </p>
            <TimestampPair label="Latest alert" value={current.profile.monitoringSummary.latestAlertAt} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Proof exports</h2>
            <div className="flex flex-col gap-2">
              <EntityLink href={current.profile.proof.jsonUrl} label="JSON proof" />
              <EntityLink href={current.profile.proof.pdfUrl} label="PDF proof" />
              <EntityLink href={current.profile.proof.auditBundleJson} label="Audit bundle" />
            </div>
          </OpsCard>
        </div>
      </div>
    </OperationsShell>
  );
}
