'use client';

import Link from 'next/link';
import { useProvider } from '@/hooks/useIntelligenceDetail';
import type { ProviderDetailResponse } from '@/lib/intelligence/detail-types';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { useGraph } from '@/hooks/useGraph';
import type { BadgeTone } from './primitives';
import { BackLink, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, riskScoreColor, trustScoreColor, severityTone } from './primitives';
import { OperationsShell } from './shell';
import { GraphWorkbenchPanel } from './graph-workbench-panel';

function intelligenceTone(value: string): BadgeTone {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('exceptional') || normalized.includes('strong') || normalized === 'expanding' || normalized === 'low') {
    return 'success';
  }

  if (normalized.includes('high risk') || normalized === 'severe' || normalized === 'contracting') {
    return 'critical';
  }

  if (normalized.includes('monitor') || normalized === 'high' || normalized === 'mixed') {
    return 'warning';
  }

  return 'info';
}

function formatSignalScore(value: number | null | undefined) {
  return typeof value === 'number' ? String(Math.round(value)) : 'Insufficient signal';
}

function formatPercentile(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}th pct` : 'Insufficient signal';
}

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
      activeNavKey="providers"
      title={current.provider.fullName}
      description={`${current.provider.providerType ?? 'Provider'} profile for NPI ${current.provider.npi} with credential evidence, trust state, and related intelligence.`}
      breadcrumbs={[
        { label: 'Providers', href: backHref },
        { label: current.provider.npi },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Provider profile</p>
          <p title={formatAbsoluteTime(current.profile.generatedAt)}>Updated {formatRelativeTime(current.profile.generatedAt)}</p>
          <p>{current.provider.activeCredentialCount}/{current.provider.totalCredentialCount} active credentials</p>
        </div>
      )}
      actions={(
        <>
          <BackLink href={backHref} label="Back to providers" />
          <Link
            href={buildIntelligenceGraphHref({ npi: current.provider.npi, providerId: current.provider.npi })}
            className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
          >
            Open graph
          </Link>
          <Link
            href={buildIntelligenceHref('investigations', { npi: current.provider.npi })}
            className="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
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
            <div>
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Identity</h2>
              <p className="mt-1 text-sm text-[var(--vt-text-3)]">Name, NPI, specialty, and public verification posture.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={current.profile.status} tone={severityTone(current.profile.status)} />
              <OpsBadge label={current.profile.trustBand} tone="info" />
              <OpsBadge label={current.provider.riskLevel} tone={severityTone(current.provider.riskLevel)} />
              <span className="font-mono text-sm text-[var(--vt-text-3)]">NPI {current.provider.npi}</span>
              {current.provider.credential ? <span className="text-sm text-[var(--vt-text-3)]">{current.provider.credential}</span> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Risk score</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${riskScoreColor(current.provider.riskScore)}`}>{current.provider.riskScore}</p>
              </div>
              <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Trust score</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${trustScoreColor(current.provider.trustScore)}`}>{current.provider.trustScore}</p>
                <p className="mt-2 text-sm text-[var(--vt-text-2)]">Band {current.profile.trustBand}</p>
              </div>
              <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Findings</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--vt-text-1)]">{current.provider.findingCount}</p>
              </div>
              <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Active storylines</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--vt-text-1)]">{current.provider.activeStorylineCount}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-[var(--vt-text-2)]">
              <p>Provider type {current.provider.providerType ?? 'Unknown'}</p>
              <p>Readiness score {current.provider.readinessScore}</p>
              <TimestampPair label="Last updated" value={current.profile.generatedAt} />
            </div>
            <div className="flex flex-wrap gap-2">
              {current.provider.specialties.length > 0 ? current.provider.specialties.map((specialty) => (
                <span key={specialty} className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
                  {specialty}
                </span>
              )) : (
                <p className="text-sm text-[var(--vt-text-3)]">No specialty metadata is available for this provider.</p>
              )}
            </div>
            {current.profile.readiness.evaluated ? (
              <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-sm text-[var(--vt-text-2)]">
                  {current.profile.readiness.isEligible
                    ? `Readiness evaluator passed after ${current.profile.readiness.traceCount} reasoning steps.`
                    : 'Readiness evaluator found gaps that still need resolution.'}
                </p>
                {current.profile.readiness.missingRequirements.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-[var(--vt-text-3)]">
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
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Credentials</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{current.credentials.length} public entries</span>
            </div>
            {current.credentials.length > 0 ? (
              <div className="space-y-3">
                {current.credentials.map((credential) => (
                  <div key={credential.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={credential.type.replace(/_/g, ' ')} />
                      <OpsBadge label={credential.status} tone={severityTone(credential.status)} />
                      <span className="text-sm text-[var(--vt-text-3)]">{credential.issuer}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--vt-text-2)]">{credential.name}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <TimestampPair label="Verified" value={credential.verifiedAt} />
                      <TimestampPair label="Expires" value={credential.expiresAt} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">No public credential summaries are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Credential evidence</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{current.profile.artifactSummaries.length} artifacts</span>
            </div>
            {current.profile.artifactSummaries.length > 0 ? (
              <div className="space-y-3">
                {current.profile.artifactSummaries.map((artifact) => (
                  <div key={artifact.artifactId} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={artifact.issuer} />
                      <OpsBadge label={artifact.status} tone={severityTone(artifact.status)} />
                      <TimestampPair label="Verified" value={artifact.verifiedAt} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[var(--vt-text-2)]">
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
              <p className="text-sm text-[var(--vt-text-3)]">No credential artifacts were returned for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Related intelligence</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{current.findings.length + current.storylines.length + current.actions.length} linked records</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Findings</h3>
                  <EntityLink href={buildIntelligenceHref('findings', { provider: current.provider.npi })} label="Open list" />
                </div>
                {current.findings.length > 0 ? current.findings.map((finding) => (
                  <div key={finding.findingId} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
                      <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
                    </div>
                    <Link href={`/findings/${finding.findingId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]">
                      {finding.title}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Updated" value={finding.updatedAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-[var(--vt-text-3)]">No findings are linked to this provider.</p>}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Storylines</h3>
                  <EntityLink href={buildIntelligenceHref('storylines', { provider: current.provider.npi })} label="Open list" />
                </div>
                {current.storylines.length > 0 ? current.storylines.map((storyline) => (
                  <div key={storyline.storylineId} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
                      <OpsBadge label={storyline.status} tone={severityTone(storyline.status)} />
                    </div>
                    <Link href={`/storylines/${storyline.storylineId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]">
                      {storyline.title}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Activity" value={storyline.lastActivityAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-[var(--vt-text-3)]">No storylines are linked to this provider.</p>}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Actions</h3>
                {current.actions.length > 0 ? current.actions.map((action) => (
                  <div key={action.actionId} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={action.priority} tone={severityTone(action.priority)} />
                      <OpsBadge label={action.status} tone={severityTone(action.status)} />
                    </div>
                    <Link href={`/actions/${action.actionId}?from=/providers/${current.provider.npi}`} className="mt-3 block text-sm font-medium text-[var(--vt-text-1)] transition hover:text-[var(--vt-accent)]">
                      {action.recommendedAction}
                    </Link>
                    <div className="mt-2">
                      <TimestampPair label="Created" value={action.createdAt} />
                    </div>
                  </div>
                )) : <p className="text-sm text-[var(--vt-text-3)]">No actions are linked to this provider.</p>}
              </div>
            </div>
          </OpsCard>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] ring-2 ring-cyan-400/10 transition-all hover:ring-cyan-400/40 bg-[var(--vt-surface)] overflow-hidden">
            <ProviderNetworkSnapshot npi={current.provider.npi} />
          </div>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Recent signals</h2>
                <p className="mt-1 text-sm text-[var(--vt-text-3)]">
                  {current.signals?.summary ?? 'No provider signal summary has been returned yet.'}
                </p>
              </div>
              {current.signals ? (
                <span className="text-xs text-[var(--vt-text-3)]" title={formatAbsoluteTime(current.signals.generatedAt)}>
                  Updated {formatRelativeTime(current.signals.generatedAt)}
                </span>
              ) : null}
            </div>

            {current.signals ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Trust</p>
                      <OpsBadge label={current.signals.trust.tier} tone={intelligenceTone(current.signals.trust.tier)} />
                    </div>
                    <p className={`mt-2 text-2xl font-semibold tabular-nums ${trustScoreColor(current.signals.trust.score ?? current.provider.trustScore)}`}>
                      {formatSignalScore(current.signals.trust.score ?? current.provider.trustScore)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--vt-text-2)]">{current.signals.trust.explanation}</p>
                  </div>

                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Influence</p>
                      <OpsBadge label={current.signals.influence.tier} tone={intelligenceTone(current.signals.influence.tier)} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-cyan-300">{formatSignalScore(current.signals.influence.score)}</p>
                    <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                      {formatPercentile(current.signals.influence.percentile)} · {current.signals.influence.explanation}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Workforce pressure</p>
                      <OpsBadge label={current.signals.workforcePressure.state} tone={intelligenceTone(current.signals.workforcePressure.state)} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--vt-text-1)]">{formatSignalScore(current.signals.workforcePressure.score)}</p>
                    <p className="mt-2 text-sm text-[var(--vt-text-2)]">{current.signals.workforcePressure.explanation}</p>
                  </div>

                  <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Institution momentum</p>
                      <OpsBadge
                        label={current.signals.institutionMomentum?.state ?? 'Insufficient signal'}
                        tone={intelligenceTone(current.signals.institutionMomentum?.state ?? 'Insufficient signal')}
                      />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--vt-text-1)]">
                      {current.signals.institutionMomentum?.institutionLabel ?? 'No institution momentum signal'}
                    </p>
                    <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                      {current.signals.institutionMomentum?.explanation ?? 'Institution momentum is unavailable for the current affiliation set.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Early warnings</h3>
                    <span className="text-sm text-[var(--vt-text-3)]">{current.signals.earlyWarnings.length}</span>
                  </div>
                  {current.signals.earlyWarnings.length > 0 ? current.signals.earlyWarnings.slice(0, 3).map((warning) => (
                    <div key={warning.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <OpsBadge label={warning.type.replace(/_/g, ' ')} tone={intelligenceTone(warning.type)} />
                        <OpsBadge label={warning.state} tone={intelligenceTone(warning.state)} />
                      </div>
                      <p className="mt-3 text-sm font-medium text-[var(--vt-text-1)]">{warning.headline}</p>
                      <p className="mt-2 text-sm text-[var(--vt-text-2)]">{warning.recommendedAction}</p>
                      <div className="mt-2">
                        <TimestampPair label="Observed" value={warning.timestamp} />
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-[var(--vt-text-3)]">No early warnings crossed the current alert thresholds.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">The backend has not returned signal data for this provider yet.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Identifiers</h2>
            {current.provider.identifiers.length > 0 ? current.provider.identifiers.map((identifier) => (
              <div key={`${identifier.label}-${identifier.value}`} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{identifier.label}</p>
                <p className="mt-2 text-sm text-[var(--vt-text-2)]">{identifier.value}</p>
              </div>
            )) : (
              <p className="text-sm text-[var(--vt-text-3)]">No identifiers are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Locations</h2>
            {current.provider.locations.length > 0 ? current.provider.locations.map((location) => (
              <div key={`${location.label}-${location.state ?? ''}`} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <p className="text-sm text-[var(--vt-text-2)]">{location.label}</p>
                {location.state ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{location.state}</p> : null}
              </div>
            )) : (
              <p className="text-sm text-[var(--vt-text-3)]">No practice locations are available for this provider.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Issuer provenance</h2>
            {current.profile.issuerProvenance.length > 0 ? current.profile.issuerProvenance.map((issuer) => (
              <div key={issuer.issuer} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={issuer.issuer} />
                  <span className="text-sm text-[var(--vt-text-3)]">{issuer.artifactCount} artifacts</span>
                </div>
                <p className="mt-2 text-sm text-[var(--vt-text-2)]">
                  <span title={formatAbsoluteTime(issuer.latestVerifiedAt)}>
                    Last verified {formatRelativeTime(issuer.latestVerifiedAt)}
                  </span>
                  {' · '}
                  statuses {issuer.statuses.join(', ')}
                </p>
              </div>
            )) : <p className="text-sm text-[var(--vt-text-3)]">No issuer provenance records are available.</p>}
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Monitoring summary</h2>
            <p className="text-sm text-[var(--vt-text-2)]">
              {current.profile.monitoringSummary.monitoredArtifactCount}/{current.profile.monitoringSummary.totalArtifactCount} artifacts monitored
            </p>
            <p className="text-sm text-[var(--vt-text-2)]">
              Coverage {(current.profile.monitoringSummary.coverageRate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-[var(--vt-text-2)]">
              Active alerts {current.profile.monitoringSummary.activeAlertCount}
            </p>
            <TimestampPair label="Latest alert" value={current.profile.monitoringSummary.latestAlertAt} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Proof exports</h2>
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

function ProviderNetworkSnapshot({ npi }: { npi: string }) {
  const graph = useGraph({
    npi,
    layer: 'blended',
    limit: 25,
  });

  return (
    <GraphWorkbenchPanel
      graph={graph.data}
      providers={[]}
      selectedProvider={null}
      openFullGraphHref={buildIntelligenceGraphHref({ npi, providerId: npi })}
      loading={graph.loading}
      error={graph.error}
      onRetry={graph.refresh}
      onSelectProvider={() => {}}
    />
  );
}
