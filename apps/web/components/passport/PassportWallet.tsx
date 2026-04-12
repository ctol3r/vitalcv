'use client';

import Link from 'next/link';

/**
 * PassportWallet.tsx — The Your readiness
 *
 * THE PRODUCT. One screen. One truth.
 *
 * Sections (spec-exact):
 *   Header       — VitalCV wordmark only
 *   PassportCard — Name, specialty, readiness status
 *   Readiness    — ✔ checked / ✖ needed / estimated start
 *   Details      — accordion: Identity, Authority, Training, Standing
 *   Share        — [Share with employer] → biometric → POST /api/share
 *
 * Doctrine:
 *   - Status conveyed through opacity, not colour
 *   - Status badge: small pill, neutral on all states
 *   - Green (emerald) only on the Share CTA button
 *   - No sidebars, no secondary nav, no decorative gradients
 *   - Mobile-first: single column, no horizontal scroll
 *   - Touch targets ≥ 44px, font-size ≥ 16px
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { CLERK_PROVIDER_ENABLED, CLERK_SIGN_IN_URL } from '@/lib/auth/clerkConfig';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import { resolveLivePathReadinessStatus } from '@/lib/live-path/contracts';
import { Accordion } from '@/components/ui/accordion';
import type { AccordionItem } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData, ReadinessStatus } from '@/lib/trust/passport-contract';
import { PassportAdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import { PassportTrustPosture } from '@/components/passport/PassportTrustPosture';
import { useTrackEvent } from '@/lib/learning/useTrackEvent';
import { EvidenceDisclosureCard } from '@/components/trust/EvidenceDisclosureCard';
import { PassportSourceCoveragePanel } from '@/components/trust/PassportSourceCoveragePanel';
import { SharePacketModal } from '@/components/passport/SharePacketModal';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { DivergenceSummaryCard } from '@/components/trust/DivergenceSummaryCard';
import { formatProofDate } from '@/lib/trust/proof-language';
import {
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthoritySectionStatus,
  resolveAuthorityTitle,
  resolveAuthorityVdsStatus,
} from '@/lib/trust/passport-truth';
import {
  normalizePassportSourceCoverageChecks,
  type PassportSourceCoverageCheck,
} from '@/lib/trust/source-coverage';
import type { VdsTrustStatus } from '@/lib/trust/status-language';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

// ── Status configuration ──────────────────────────────────────────────────────
// NO colour on status. Hierarchy via opacity only.

const STATUS_CONFIG: Record<ReadinessStatus, {
  cardBorder:   string;
  cardBg:       string;
}> = {
  READY:   { cardBorder: 'border-border', cardBg: 'bg-muted' },
  PARTIAL: { cardBorder: 'border-border', cardBg: 'bg-card' },
  BLOCKED: { cardBorder: 'border-white/8', cardBg: 'bg-card' },
};

const SOURCE_COVERAGE_ORDER: Record<string, number> = {
  checked: 0,
  stale: 1,
  reviewRequired: 2,
  accessRequired: 3,
  gated: 3,
  notDecisionGrade: 4,
  pending: 4,
  unavailable: 4,
  previewOnly: 4,
};

function sortPassportSourceCoverageChecks(
  checks: PassportSourceCoverageCheck[],
): PassportSourceCoverageCheck[] {
  return [...checks].sort((left, right) => (
    (SOURCE_COVERAGE_ORDER[left.state] ?? 5) - (SOURCE_COVERAGE_ORDER[right.state] ?? 5)
    || left.sourceId.localeCompare(right.sourceId)
  ));
}

function PassportFreshnessCard({
  freshness,
}: {
  freshness: PassportData['trustPosture']['freshness'];
}) {
  const summaryBadge =
    freshness.state === 'current'
      ? { status: 'checked' as const, label: 'Current' }
      : freshness.state === 'stale'
        ? { status: 'stale' as const, label: 'Stale' }
        : { status: 'pending' as const, label: 'Partial' };

  return (
    <Card className="gap-3 rounded-2xl border-white/8 bg-card px-5 py-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground/60 text-[10px] uppercase tracking-widest">Freshness</p>
          <p className="mt-1 text-sm text-foreground/60">{freshness.label}</p>
        </div>
        <TrustStatusBadge status={summaryBadge.status} label={summaryBadge.label} size="sm" />
      </div>
      <div className="space-y-2 border-t border-white/6 pt-3">
        {freshness.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/6 bg-muted px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-foreground/70">{item.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.note}</p>
              </div>
              <TrustStatusBadge
                status={item.state === 'current' ? 'checked' : item.state === 'stale' ? 'stale' : 'pending'}
                label={item.state}
                size="sm"
                className="shrink-0"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/30">
              <span>{item.source}</span>
              <span>{item.checkedAt ? `Checked ${formatProofDate(item.checkedAt)}` : 'Not yet checked'}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Row primitives ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/60">{value}</span>
    </div>
  );
}

// ── Accordion section builders ─────────────────────────────────────────────────

function buildIdentitySection(passport: PassportData): AccordionItem {
  const { identity, lastCheckedAt } = passport;
  return {
    id:      'identity',
    trigger: 'Identity',
    // NPPES ACTIVE = NPI is valid and active — not a credential verification.
    // 'checked' is the honest status: we confirmed the NPI exists, nothing more.
    status:  identity.status === 'ACTIVE' ? 'checked' : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Name"       value={identity.displayName} />
        <DetailRow label="Specialty"  value={identity.specialty} />
        <DetailRow label="NPI"        value={identity.npi} />
        <DetailRow label="Type"       value={identity.entityType === 'PERSON' ? 'Individual provider' : 'Organization'} />
        <DetailRow label="Source"     value="CMS NPPES" />
        <DetailRow label="Last check" value={new Date(lastCheckedAt).toLocaleDateString()} />
      </div>
    ),
  };
}

// ── Authority row renderer (MS15) ────────────────────────────────────────────
// Shared display contract: title · status · source · checkedAt · confidence · freshness

interface AuthorityRowProps {
  title:       string;
  status:      VdsTrustStatus;
  sourceLabel: string;
  checkedAt?:  string | null;
  confidence?: string | null;
  freshness?:  string | null;
  note?:       string | null;
}

function AuthorityRow({ title, status, sourceLabel, checkedAt, confidence, freshness, note }: AuthorityRowProps) {
  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs">
        <span className="text-foreground/60">{title}</span>
        <TrustStatusBadge status={status} size="sm" />
      </div>
      <div className="flex justify-between text-xs mt-0.5">
        <span className="text-muted-foreground/50">Source: {sourceLabel}</span>
        {freshness && <span className="text-muted-foreground/30">{freshness}</span>}
      </div>
      {(checkedAt || confidence) && (
        <div className="text-muted-foreground/40 text-xs mt-0.5 flex gap-2 flex-wrap">
          {checkedAt && <span>Checked {checkedAt}</span>}
          {confidence && <span>· {confidence}</span>}
        </div>
      )}
      {note && <div className="text-muted-foreground/30 text-xs mt-0.5 leading-relaxed">{note}</div>}
    </div>
  );
}

function buildAuthoritySection(passport: PassportData): AccordionItem {
  const { authority } = passport;
  const displayCredentials = authority.credentials.filter((credential) => (
    credential.domain !== 'BOARD_CERTIFICATION'
    && credential.domain !== 'DEA_REGISTRATION'
  ));

  const hasLicensure = displayCredentials.some(c => c.domain === 'LICENSURE');

  return {
    id:      'authority',
    trigger: 'Authority',
    status:  resolveAuthoritySectionStatus(authority.credentials, authority.summary.missing),
    content: (
      <div className="py-1 space-y-0">

        {/* Real credential rows — authority claim code drives display */}
        {displayCredentials.map(c => (
          <AuthorityRow
            key={c.id}
            title={resolveAuthorityTitle(c)}
            status={resolveAuthorityVdsStatus(c)}
            sourceLabel={resolveAuthorityMethodLabel(c)}
            checkedAt={c.observedAt ? formatProofDate(c.observedAt) : null}
            confidence={c.claimConfidenceLabel}
            freshness={c.dataFreshnessLabel}
            note={resolveAuthorityNote(c)}
          />
        ))}

        {/* Gap: no licensure credentials attached — show access-required state */}
        {!hasLicensure && (
          <AuthorityRow
            title="License verification"
            status="access_required"
            sourceLabel="Configured state board lane"
            note="Access required. Authority remains incomplete until a connected state board lane runs."
          />
        )}

        {/* Missing blocking domains (exclude always-present ones) */}
        {authority.summary.missing
          .filter(d => !['IDENTITY', 'EXCLUSION_CHECK'].includes(d))
          .map(d => (
            <div key={d} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-xs text-muted-foreground/40">{d.replace(/_/g, ' ').toLowerCase()}</span>
              <TrustStatusBadge status="blocked" size="sm" />
            </div>
          ))}
      </div>
    ),
  };
}

function buildTrainingSection(passport: PassportData): AccordionItem {
  const { training } = passport;
  return {
    id:      'training',
    trigger: 'Training confirmed by issuing institution',
    status:  training.degreeVerified && training.hasResidency ? 'checked'
           : training.hasDegree                               ? 'pending'
           : 'review_required',
    content: (
      <div className="py-1 space-y-1">
        {training.records.length === 0 && (
          <p className="text-muted-foreground/50 text-xs py-1">No training records on file.</p>
        )}
        {training.records.map(r => (
          <div key={r.id} className="py-1.5 border-b border-white/5 last:border-0">
            <div className="flex justify-between text-xs">
              <span className="text-foreground/60">{r.degreeOrTitle ?? r.recordType.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="text-muted-foreground">{r.endYear ?? '—'}</span>
            </div>
            {(r.institutionName || r.specialty) && (
              <div className="text-muted-foreground/60 text-xs mt-0.5">
                {[r.institutionName, r.specialty].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  };
}

function buildStandingSection(passport: PassportData): AccordionItem {
  const { standing } = passport;
  // Standing = exclusion / sanctions only (PECOS moved to Eligibility section)
  const safetyNegative = standing.negativeFindings.filter(f =>
    !/pecos|enrollment|medicare/i.test(f)
  );
  const allClear =
    standing.exclusionClear &&
    standing.licensureStatus === 'verified' &&
    safetyNegative.length === 0;

  const exclusionLabel =
    standing.exclusionStatus === 'CLEAR' ? 'Checked'
    : standing.exclusionStatus === 'POSSIBLE_MATCH' ? 'Review required'
    : standing.exclusionStatus === 'EXCLUDED' ? 'Blocked'
    : 'Unavailable';
  const licensureLabel =
    standing.licensureStatus === 'verified' ? 'Source-backed'
    : standing.licensureStatus === 'expired' ? 'Blocked'
    : standing.licensureStatus === 'pending' ? 'Pending'
    : 'Unavailable';

  return {
    id:      'standing',
    trigger: 'Safety',
    status:  allClear                               ? 'checked'
           : standing.exclusionStatus === 'UNCHECKED' ? 'pending'
           : safetyNegative.length > 0             ? 'review_required'
           : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Exclusion check"   value={exclusionLabel} />
        <DetailRow label="Checked"           value={formatProofDate(standing.exclusionCheckedAt)} />
        <DetailRow label="Confidence"        value={standing.exclusionConfidenceLabel} />
        <DetailRow label="License"           value={licensureLabel} />
        {safetyNegative.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
            <span className="text-muted-foreground/50 select-none">⚠</span>
            <span className="text-foreground/70">{f}</span>
          </div>
        ))}
        {safetyNegative.length === 0 && (
          <div className="text-muted-foreground/60 text-xs pt-1">No negative findings.</div>
        )}
      </div>
    ),
  };
}

// ── MS16-B: Eligibility row (same contract as AuthorityRow) ──────────────────

interface EligibilityRowProps {
  title:        string;
  status:       VdsTrustStatus;
  sourceLabel:  string;
  checkedAt?:   string | null;
  dataVersion?: string | null;
  freshness?:   string | null;
  confidence?:  string | null;
  note?:        string | null;
}

function EligibilityRow({
  title, status, sourceLabel, checkedAt, dataVersion, freshness, confidence, note,
}: EligibilityRowProps) {
  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs gap-2">
        <span className="flex items-center gap-1.5 text-foreground/60">{title}</span>
        <TrustStatusBadge status={status} size="sm" />
      </div>
      <div className="flex justify-between text-xs mt-0.5 pl-4">
        <span className="text-muted-foreground/50">Source: {sourceLabel}</span>
        {freshness && <span className="text-muted-foreground/30">{freshness}</span>}
      </div>
      {(checkedAt || dataVersion || confidence) && (
        <div className="text-muted-foreground/40 text-xs mt-0.5 pl-4 flex gap-2 flex-wrap">
          {dataVersion && <span>{dataVersion}</span>}
          {checkedAt && <span>· Checked {checkedAt}</span>}
          {confidence && <span>· {confidence}</span>}
        </div>
      )}
      {note && <div className="text-muted-foreground/30 text-xs mt-0.5 pl-4 leading-relaxed">{note}</div>}
    </div>
  );
}

function buildEligibilitySection(passport: PassportData): AccordionItem {
  const { standing } = passport;
  const s = standing.pecosEnrollmentStatus ?? (
    standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
    standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
  );

  const rowStatus: EligibilityRowProps['status'] =
    s === 'ENROLLED'  ? 'enrolled' :
    s === 'NOT_FOUND' ? 'review_required' :
    s === 'UNKNOWN'   ? 'unavailable' :
    'unavailable';

  const sectionStatus: AccordionItem['status'] =
    rowStatus === 'enrolled'  ? 'checked' :
    rowStatus === 'review_required' ? 'review_required' :
    'pending';

  // Build observed-as quarter label
  function enrolledAsLabel(observedAt?: string | null, dataVersion?: string | null): string | null {
    if (dataVersion) return dataVersion;
    if (!observedAt) return null;
    const d = new Date(observedAt);
    if (Number.isNaN(d.getTime())) return null;
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  }

  const quarterLabel = enrolledAsLabel(standing.enrollmentObservedAt, standing.enrollmentDataVersion);
  const titleWithQuarter =
    rowStatus === 'enrolled' && quarterLabel
      ? `Medicare enrollment — as of ${quarterLabel}`
      : 'Medicare enrollment';

  return {
    id:      'eligibility',
    trigger: 'Eligibility',
    status:  sectionStatus,
    content: (
      <div className="py-1 space-y-0">
        <EligibilityRow
          title={titleWithQuarter}
          status={rowStatus}
          sourceLabel={standing.enrollmentSourceLabel ?? 'CMS PECOS'}
          checkedAt={standing.enrollmentObservedAt ? formatProofDate(standing.enrollmentObservedAt) : null}
          dataVersion={quarterLabel}
          freshness={standing.enrollmentFreshnessLabel ?? standing.enrollmentDataFreshness ?? 'Quarterly'}
          confidence={standing.enrollmentConfidenceLabel ?? undefined}
          note={standing.enrollmentNote ?? undefined}
        />
        {rowStatus === 'review_required' && (
          <div className="py-1.5 text-muted-foreground/40 text-xs pl-4 leading-relaxed">
            Not finding a provider in PECOS may indicate non-enrollment or a quarterly data lag.
            Confirm by requesting current enrollment confirmation directly or via pecos.cms.hhs.gov.
          </div>
        )}
        {rowStatus === 'unavailable' && (
          <div className="py-1.5 text-muted-foreground/40 text-xs pl-4">
            PECOS lookup has not been performed. Eligibility is unknown.
          </div>
        )}
      </div>
    ),
  };
}

// ── Main wallet component ──────────────────────────────────────────────────────

interface PassportWalletLoadedProps {
  passport: PassportData;
}

interface PassportWalletLoadingProps {
  loading: true;
}

type Props = PassportWalletLoadedProps | PassportWalletLoadingProps;

function PassportWalletLoadingShell() {
  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-12 sm:pt-16 pb-24">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-muted-foreground/60 text-xs tracking-widest uppercase">VitalCV</span>
        </div>

        <Card className="gap-0 rounded-2xl border border-border bg-muted px-5 py-5 shadow-none">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">Passport</p>
          <Skeleton className="mt-3 h-7 w-40 rounded-full" />
          <Skeleton className="mt-2 h-4 w-28 rounded-full" />
          <div className="mt-4">
            <TrustStatusBadge status="pending" label="Pending" size="sm" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Resolving source-backed passport sections. Nothing is promoted to checked until real source data arrives.
          </p>
        </Card>

        <Card className="gap-3 rounded-2xl border-white/8 bg-card px-5 py-4 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground/60 text-[10px] uppercase tracking-widest">Summary</p>
              <p className="mt-1 text-sm text-foreground/70">READY / PARTIAL / BLOCKED</p>
            </div>
            <TrustStatusBadge status="pending" label="Pending" size="sm" />
          </div>
          <div className="space-y-3 border-t border-white/6 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">NPPES</span>
              <TrustStatusBadge status="pending" label="Pending" size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">OIG / LEIE</span>
              <TrustStatusBadge status="pending" label="Pending" size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">CMS PECOS</span>
              <TrustStatusBadge status="pending" label="Pending" size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Configured state board lane</span>
              <TrustStatusBadge status="pending" label="Pending" size="sm" />
            </div>
          </div>
        </Card>

        <Card className="gap-4 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-5 shadow-none">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-[88%] rounded-full" />
          </div>
          <div className="space-y-3 border-t border-white/6 pt-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}

function PassportWalletLoaded({ passport }: PassportWalletLoadedProps) {
  const trackEvent = useTrackEvent();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('Passport_Viewed', { npi: passport.npi });
    }
    if (passport.npi) {
      trackEvent('PROFILE_VIEWED', { providerId: passport.npi });
    }
  }, [passport.npi, trackEvent]);

  const [sharing, setSharing] = useState(false);
  const [shared,  setShared]  = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingRefreshCount, setPendingRefreshCount] = useState(0);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    const npi = passport.npi ?? passport.identity?.npi;
    if (!npi || !/^\d{10}$/.test(npi)) return;
    fetch(`/api/employer-review/npi/${npi}/refresh-requests`)
      .then((res) => res.ok ? res.json() as Promise<{ count: number }> : Promise.resolve({ count: 0 }))
      .then((data) => setPendingRefreshCount(data.count))
      .catch(() => void 0);
  }, [passport.npi, passport.identity?.npi]);

  // Pre-check auth before showing share UI — prevents click-then-error UX
  const { isSignedIn, isLoaded } = CLERK_PROVIDER_ENABLED
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth()
    : { isSignedIn: true, isLoaded: true };
  const isAuthReady = !CLERK_PROVIDER_ENABLED || isLoaded;
  const canShare    = !CLERK_PROVIDER_ENABLED || isSignedIn;

  const { identity, readiness, trustPosture } = passport;
  const cfg = STATUS_CONFIG[readiness.status];
  const sourceCoverageChecks = sortPassportSourceCoverageChecks(
    normalizePassportSourceCoverageChecks(passport.sourceCoverage),
  );
  const showReadinessScore = sourceCoverageChecks.some((check) => check.state === 'checked');

  // MS16-F: Trust stack order — Identity → Safety → Authority → Eligibility → Readiness
  const accordionItems: AccordionItem[] = [
    buildIdentitySection(passport),
    buildAuthoritySection(passport),
    buildTrainingSection(passport),
    buildStandingSection(passport),
    buildEligibilitySection(passport),
  ];

  async function handleShare() {
    if (!passport.npi) {
      setShareError('This passport is missing an NPI and cannot be shared.');
      return;
    }
    setSharing(true);
    setShareError(null);
    try {
      // Generate a shareable apply bundle with a generic pilot context.
      // This ensures a BundleShareEvent is written to the audit log for KPI tracking.
      const res = await fetch('/api/apply/share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npi: passport.npi,
          organization_context: {
            organization_id: 'pilot-manual-share',
            name: 'Employer Review (Link Share)',
            purpose_of_use: 'Pilot Ops manual share link generation',
          }
        }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to generate a shareable passport link.');
        if (res.status === 404) throw new Error('Passport data not found. Run an NPI lookup first.');
        throw new Error('Could not generate share link. Try again.');
      }

      const data = await res.json() as { bundleId?: string; bundleUrl?: string; error?: string };
      if (!data.bundleId) throw new Error(data.error ?? 'Share link generation failed.');

      // Copy bundle URL to clipboard
      const shareUrl = data.bundleUrl ?? `${window.location.origin}/apply/${data.bundleId}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }

      setShared(true);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Share failed.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-8 sm:pt-12 pb-24">
      <div className="w-full max-w-2xl space-y-6">

        {/* ── Header — brutalist minimal ─────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[var(--vt-border)] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground flex items-center justify-center text-background text-xs font-bold tracking-tight">V</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">VitalCV · Clinician Passport</span>
          </div>
          <Link href="/passport" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-foreground transition-colors">
            View another NPI
          </Link>
        </div>

        {/* ── Employer refresh request notification ─────────────────────────── */}
        {pendingRefreshCount > 0 && (
          <div className="border border-amber-500/40 bg-amber-500/8 px-4 py-3">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">
              {pendingRefreshCount === 1
                ? 'An employer has requested updated credentials.'
                : `${pendingRefreshCount} employers have requested updated credentials.`}
            </p>
            <p className="text-amber-300/60 text-[10px] mt-1 font-mono">
              Run a new NPI check to refresh your credential data.
            </p>
          </div>
        )}

        {/* ── Passport card — brutalist header block ────────────────────────── */}
        <div className="border border-[var(--vt-border)] bg-card px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Clinician</p>
              <h1 className="text-foreground text-4xl font-bold tracking-tight leading-none uppercase">
                {identity.displayName}
              </h1>
              {identity.specialty && (
                <p className="text-muted-foreground text-sm mt-2 font-mono">{identity.specialty}</p>
              )}
              {passport.npi && (
                <p className="text-muted-foreground/40 text-xs mt-1 font-mono">NPI {passport.npi}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Readiness</p>
              <div className="text-5xl font-bold tracking-tighter font-mono text-foreground">
                {showReadinessScore ? readiness.score : 'Withheld'}
                {showReadinessScore ? <span className="text-2xl text-muted-foreground/40">/100</span> : null}
              </div>
              {!showReadinessScore ? (
                <p className="mt-2 text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                  Score appears after source-backed claims attach
                </p>
              ) : null}
              <div className="mt-2">
                <TrustStatusBadge
                  status={resolveLivePathReadinessStatus(readiness.status)}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Trust Posture ─────────────────────────────────────────────────── */}
        <SectionReveal delay={0}>
          <PassportTrustPosture posture={trustPosture} />
        </SectionReveal>

        {/* ── Wave 245: Continuous Monitoring Status ─────────────────────── */}
        {passport.monitoring?.active && (
          <SectionReveal delay={0.02}>
            <div className="border border-[var(--vt-border)] bg-card px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">
                    Continuously Monitored
                  </p>
                </div>
                {passport.monitoring.activeAlertCount > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    {passport.monitoring.activeAlertCount} alert{passport.monitoring.activeAlertCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {passport.monitoring.lastCheckAt && (
                <p className="mt-1 text-[10px] text-muted-foreground/40 font-mono">
                  Last check: {formatProofDate(passport.monitoring.lastCheckAt)}
                </p>
              )}
              {passport.monitoring.monitoredSources.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/6 pt-3">
                  {passport.monitoring.monitoredSources.map((source) => (
                    <div key={source.sourceId} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground/60 font-mono">{source.sourceLabel}</span>
                      <div className="flex items-center gap-1.5">
                        {source.lastCheckAt && (
                          <span className="text-muted-foreground/30">{formatProofDate(source.lastCheckAt)}</span>
                        )}
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          source.status === 'active' ? 'bg-emerald-500' :
                          source.status === 'paused' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionReveal>
        )}

        {/* ── NPI disclaimer — identity anchor clarification ─────────────── */}
        {passport.npi && (
          <SectionReveal delay={0.05}>
            <p className="text-muted-foreground/40 text-[10px] font-mono text-left leading-relaxed border border-[var(--vt-border-subtle)] px-4 py-2.5 uppercase tracking-widest">
              NPI {passport.npi} confirms identity only — does not confirm licensure, enrollment, or credential status.
            </p>
          </SectionReveal>
        )}

        {/* ── Freshness ─────────────────────────────────────────────────────── */}
        <SectionReveal delay={0.1}>
          <PassportFreshnessCard freshness={trustPosture.freshness} />
        </SectionReveal>

        {/* ── Source coverage — explicit checked/stale/gated/preview-only per source ──── */}
        <SectionReveal delay={0.15}>
          <PassportSourceCoveragePanel checks={sourceCoverageChecks} />
        </SectionReveal>

        {passport.divergence?.activeCount ? (
          <SectionReveal delay={0.18}>
            <DivergenceSummaryCard divergence={passport.divergence} mode="passport" />
          </SectionReveal>
        ) : null}

        {/* ── Details accordion ─────────────────────────────────────────────── */}
        <SectionReveal delay={0.2}>
          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="View source-backed evidence by section"
            description="Each disclosure keeps trust-core proof, contextual notes, and gaps explicit."
            className="rounded-2xl border-white/8 bg-white/[0.03]"
            contentClassName="px-5 py-1"
          >
            <Accordion items={accordionItems} />
          </EvidenceDisclosureCard>
        </SectionReveal>

        {/* ── Next actions (from readiness engine) ──────────────────────────── */}
        {readiness.nextActions.length > 0 && (
          <SectionReveal delay={0.25}>
            <Card className="gap-3 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-4 shadow-none">
              <p className="text-foreground/70 text-sm font-medium">What should happen next</p>
              {readiness.nextActions.slice(0, 4).map((action) => (
                <div key={action.id} className="flex items-start gap-3">
                  <span className="text-muted-foreground/50 mt-1 select-none text-xs">—</span>
                  <div>
                    <p className="text-foreground/70 text-sm">{action.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{action.detail}</p>
                  </div>
                </div>
              ))}
            </Card>
          </SectionReveal>
        )}

        {/* ── Explicit missing items ─────────────────────────────────────── */}
        {(trustPosture.missingItems.length > 0 || trustPosture.gatedItems.length > 0) && (
          <SectionReveal delay={0.28}>
            <Card className="gap-3 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-4 shadow-none">
              <p className="text-white/50 text-sm font-medium">Data not yet available</p>
              <p className="text-white/25 text-xs leading-relaxed">
                These items are not covered in this snapshot. They require additional source access or have not been checked.
              </p>
              <div className="space-y-2 mt-1">
                {trustPosture.missingItems.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-white/20 mt-0.5 select-none text-xs">—</span>
                    <div>
                      <p className="text-white/55 text-xs">{item}</p>
                      <p className="text-white/25 text-[10px] mt-0.5">Missing — not yet checked</p>
                    </div>
                  </div>
                ))}
                {trustPosture.gatedItems.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-white/20 mt-0.5 select-none text-xs">—</span>
                    <div>
                      <p className="text-white/55 text-xs">{item}</p>
                      <p className="text-white/25 text-[10px] mt-0.5">Gated — requires institutional access</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </SectionReveal>
        )}

        {/* ── Advisory Panel — clinician-facing, clearly advisory ─── */}
        <PassportAdvisoryPanel passport={passport} />

        {/* ── Share section ─────────────────────────────────────────────────── */}
        <SectionReveal delay={0.3}>
          <div className="space-y-3 pt-2">
            {!shared ? (
              <>
                {isAuthReady && !canShare ? (
                  /* Unauthenticated — show sign-in prompt, never a click-then-fail button */
                  <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3 text-center">
                    <p className="text-foreground text-sm leading-relaxed">
                      Sign in to generate a shareable passport link.
                    </p>
                    <Link
                      href={`${CLERK_SIGN_IN_URL}?redirect_url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 transition-colors"
                    >
                      Sign in to share
                    </Link>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => setShareModalOpen(true)}
                      disabled={sharing || !isAuthReady}
                      variant="success"
                      className="h-14 w-full rounded-none text-xs font-bold uppercase tracking-widest"
                      aria-label="Generate shareable passport link"
                    >
                      {sharing ? 'Generating link…' : 'Share with employer'}
                    </Button>
                    {shareError && (
                      <p className="text-[var(--vt-critical)] text-xs text-center">{shareError}</p>
                    )}
                    <p className="text-center text-muted-foreground/40 text-xs leading-relaxed">
                      Generates a shareable link. Send it to an employer to open the review surface.
                    </p>
                  </>
                )}
              </>
            ) : (
              <TrustStateCard
                title="Link copied"
                description="The passport share link has been copied to your clipboard. Send it to an employer to open the review surface."
                tone="success"
                centered
              />
            )}
          </div>
        </SectionReveal>

        <SharePacketModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          npi={passport.npi ?? ''}
          clinicianName={identity.displayName}
          entityId={''}
        />

        {/* ── Footer nav ───────────────────────────────────────────────────── */}
        <div className="text-center pt-2">
          <Link
            href={PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}
            className="text-muted-foreground/40 hover:text-muted-foreground text-xs transition-colors"
          >
            View another NPI
          </Link>
        </div>

      </div>
    </main>
  );
}

export default function PassportWallet(props: Props) {
  if ('loading' in props && props.loading) {
    return <PassportWalletLoadingShell />;
  }

  if (!('passport' in props)) {
    return <PassportWalletLoadingShell />;
  }

  return <PassportWalletLoaded passport={props.passport} />;
}
