'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BellRing,
  BriefcaseBusiness,
  Compass,
  Gauge,
  History,
  RefreshCw,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  ApplicationList,
  NotificationList,
  OpportunityGrid,
  QuickActionGrid,
  SelectedOpportunityBanner,
} from '@/components/mobile/ClinicianPanels';
import type { MobileQuickAction } from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { RecognitionCard } from '@/components/recognition/RecognitionCard';
import CareerCompass from '@/components/matcha/CareerCompass';
import ProductLoopRail from '@/components/holder/ProductLoopRail';
import { Reveal } from '@/components/motion/Reveal';
import { FEATURES } from '@/lib/features';
import { MatchaHomeActivity } from '@/components/matcha/MatchaHomeActivity';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { buildClinicianProofSummary } from '@/lib/proof/proof-model';

/** One heartbeat cycle for the readiness-card vitals monitor, tiled for a
 *  seamless loop. Matches the homepage wallet's clinical-monitor language. */
const READINESS_EKG =
  'M0 22 H26 L34 22 L40 12 L46 30 L52 6 L58 34 L64 22 L72 22 H104 L112 22 L118 14 L124 28 L130 22 H160';

function resumeLabel(path: string | null): { title: string; href: string } | null {
  if (!path || path === '/holder/home') {
    return null;
  }

  if (path.startsWith('/holder/applications/')) {
    return { title: 'Return to your application detail', href: path };
  }

  if (path.startsWith('/holder/applications')) {
    return { title: 'Return to your updates queue', href: path };
  }

  if (path.startsWith('/holder/blockers/')) {
    return { title: 'Resume your blocker resolution', href: path };
  }

  if (path.startsWith('/holder/readiness')) {
    return { title: 'Return to readiness history', href: path };
  }

  if (path.startsWith('/holder/opportunities?apply=')) {
    return { title: 'Resume your application start', href: path };
  }

  if (path.startsWith('/holder/opportunities')) {
    return { title: 'Return to your live role feed', href: path };
  }

  if (path.startsWith('/holder')) {
    return { title: 'Return to your readiness', href: path };
  }

  return { title: 'Continue where you left off', href: path };
}

function readinessMomentumCopy(input: {
  hasReadiness: boolean;
  blockers: number;
  readinessScore: number;
  completeness: number;
}): string {
  if (!input.hasReadiness) {
    return 'Start onboarding to build your readiness baseline.';
  }

  if (input.blockers === 0) {
    return 'You are ready to keep moving.';
  }

  if (input.blockers === 1 && Math.max(input.readinessScore, input.completeness) >= 75) {
    return 'You are close. Resolve 1 more item to feel ready.';
  }

  return `${input.blockers} item${input.blockers === 1 ? '' : 's'} left before you feel fully ready.`;
}

function countCompletedProfileChecks(
  dimensions: {
    npiVerified: boolean;
    resumeUploaded: boolean;
    linksAdded: boolean;
    workAuthProvided: boolean;
    credentialsImported: boolean;
  } | null | undefined,
): number {
  if (!dimensions) {
    return 0;
  }

  return Object.values(dimensions).filter(Boolean).length;
}

export default function ClinicianHomeSurface() {
  const {
    data,
    visibleNotifications,
    unreadNotifications,
    previousVisitAt,
    resumePath,
    isRefreshing,
    refreshError,
    refresh,
  } = useClinicianMobile();
  const resume = resumeLabel(resumePath);
  const readiness = data.trustState;
  const profile = data.workspace?.personProfile;
  const npi = profile?.npi ?? 'unknown';
  const hasValidNpi = /^\d{10}$/.test(npi);
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || 'Your VitalCV Wallet';
  // Share the real, public, source-backed proof (what an employer actually
  // reads) — never the demo-backed presentation flow. Falls back to the wallet
  // when no NPI is bound yet.
  const shareHref = hasValidNpi ? `/verify/${npi}` : '/holder';
  const completeness = data.profileCompleteness?.score ?? data.workspace?.personProfile?.completeness ?? 0;
  const completedProfileChecks = countCompletedProfileChecks(data.profileCompleteness?.dimensions);
  const profileComplete = completeness >= 100 || completedProfileChecks >= 5;
  const previousVisitMs = previousVisitAt ? Date.parse(previousVisitAt) : 0;
  const changesSinceLastVisit = previousVisitMs > 0
    ? visibleNotifications.filter((notification) => Date.parse(notification.occurredAt) > previousVisitMs)
    : [];
  const highlightedChange = changesSinceLastVisit[0] ?? unreadNotifications[0] ?? null;
  const readinessMomentum = readinessMomentumCopy({
    hasReadiness: Boolean(readiness),
    blockers: data.blockers.length,
    readinessScore: readiness?.readinessScore ?? 0,
    completeness,
  });
  const primaryAction = resume
    ? {
        eyebrow: 'Continue',
        title: resume.title,
        detail: highlightedChange?.body ?? 'Pick up where you left off without losing progress.',
        href: resume.href,
        label: 'Continue',
        tone: 'sky' as const,
      }
    : {
        eyebrow: data.recommendedAction?.kind === 'finish_onboarding' ? 'Start here' : 'Next step',
        title: data.recommendedAction?.title ?? 'Open your readiness',
        detail: highlightedChange
          ? `${data.recommendedAction?.description ?? 'Keep your source-backed identity ready to share.'} Latest: ${highlightedChange.title}.`
          : data.recommendedAction?.description ?? 'Keep your source-backed identity ready to share.',
        href: data.recommendedAction?.href ?? '/holder',
        label: data.recommendedAction?.kind === 'resolve_gap'
          ? data.recommendedAction.ctaLabel
          : data.recommendedAction?.kind === 'apply_now'
            ? data.recommendedAction?.ctaLabel ?? 'View opportunities'
            : data.recommendedAction?.kind === 'view_application'
              ? 'View application'
              : data.recommendedAction?.ctaLabel ?? 'Open passport',
        tone: 'emerald' as const,
      };
  const proof = buildClinicianProofSummary(data);

  React.useEffect(() => {
    if (!previousVisitAt) {
      return;
    }

    void trackClinicianEventOncePerSession(`return-session:${npi}:${previousVisitAt}`, 'clinician.return_session', {
      npi,
      previousVisitAt,
      unreadCount: unreadNotifications.length,
      resumePath,
    });
  }, [npi, previousVisitAt, resumePath, unreadNotifications.length]);

  const quickActions: MobileQuickAction[] = [
    {
      id: 'open-scoreboard',
      label: 'Career scoreboard',
      description: 'Your career at a glance — readiness, recognition, live roles, and the next clear step.',
      href: '/holder/scoreboard',
      icon: Gauge,
      tone: 'emerald',
    },
    {
      id: 'finish-onboarding',
      label: readiness ? 'View readiness' : 'Start onboarding',
      description: readiness
        ? readinessMomentum
        : 'Connect your clinician profile and unlock your live readiness baseline.',
      href: readiness ? '/holder/readiness' : '/onboarding',
      icon: ShieldCheck,
      tone: 'emerald',
    },
    {
      id: 'browse-roles',
      label: data.recommendedAction?.kind === 'apply_now'
        ? data.recommendedAction.ctaLabel
        : 'View opportunities',
      description: data.recommendedAction?.kind === 'apply_now'
        ? data.recommendedAction.description
        : 'Review matched roles and keep your next application moving.',
      href: data.recommendedAction?.kind === 'apply_now'
        ? data.recommendedAction.href
        : '/holder/opportunities',
      icon: Compass,
      tone: 'sky',
    },
    {
      id: 'open-updates',
      label: 'View applications',
      description: 'Track active applications and every employer update in one place.',
      href: '/holder/applications',
      icon: BellRing,
      tone: 'amber',
    },
    {
      id: 'open-profile',
      label: 'Professional profile',
      description: 'Review your profile record and add self-attested career links and work authorization.',
      href: '/clinician/profile',
      icon: UserRound,
      tone: 'zinc',
    },
    {
      id: 'open-timeline',
      label: 'Career timeline',
      description: 'Your professional timeline — evidence checks, trust milestones, recognition, and mobility changes.',
      href: '/holder/timeline',
      icon: History,
      tone: 'zinc',
    },
    {
      id: 'open-settings',
      label: 'Settings',
      description: 'Account, identity binding, and sharing.',
      href: '/holder/settings',
      icon: Settings,
      tone: 'zinc',
    },
  ];

  // The full MATCHA experience (Career DNA, preference tuning, live matches) is
  // real + honest but pilot-gated behind NEXT_PUBLIC_FEATURE_MATCHA_V2. Surface a
  // discoverable entry exactly when the pilot is enabled, so the experience is
  // reachable from the dashboard instead of orphaned at a URL only.
  if (FEATURES.MATCHA_V2) {
    quickActions.unshift({
      id: 'open-matcha',
      label: 'Your Career DNA',
      description: 'Meet MATCHA — teach it what you want, and see the career it understands.',
      href: '/holder/matcha',
      icon: Sparkles,
      tone: 'emerald',
    });
  }

  return (
    <main className="mz mz-paper mz-persona-holder mz-ambient min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
        <Reveal
          as="header"
          variant="fade"
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <div className="mz-eyebrow">
              <Wallet className="h-3.5 w-3.5" />
              Your VitalCV Wallet
            </div>
            <h1 className="mz-h1 mt-4 truncate">
              {displayName}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 mz-small">
              {hasValidNpi ? (
                <span className="mz-mono">NPI {npi}</span>
              ) : (
                <span>Add your NPI to build your source-backed readiness.</span>
              )}
              {profile?.specialty ? (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span>{profile.specialty}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={shareHref}
              className="mz-btn min-h-12"
            >
              <Share2 className="h-4 w-4" />
              {hasValidNpi ? 'Share / prove' : 'Set up sharing'}
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="mz-btn mz-btn-ghost min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </Reveal>

        <CareerCompass />

        {refreshError ? (
          <ClinicianStatusBanner
            tone="error"
            title="Home state could not refresh"
            detail={refreshError}
            onAction={() => { void refresh(); }}
            onActionLabel={isRefreshing ? 'Retrying…' : 'Retry now'}
            actionHref="/holder/readiness"
            actionLabel="Open readiness"
          />
        ) : null}

        <SelectedOpportunityBanner />

        <MatchaHomeActivity />

        <ProductLoopRail
          npi={hasValidNpi ? npi : null}
          profileComplete={profileComplete}
          hasReadiness={Boolean(readiness)}
        />

        <Reveal>
          <section className="mz-glass-strong mz-glass-interactive p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mz-eyebrow">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                MATCHA · Your next step
              </span>
              <span className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
                {primaryAction.eyebrow}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="mz-h1">
                  <span className="mz-accent">{primaryAction.title}</span>
                </h2>
                <p className="mt-2 mz-body">
                  {primaryAction.detail}
                </p>
                <p className="mt-2 mz-small">
                  Reasoned from your source-backed readiness signals — VitalCV shows the evidence
                  behind every step and never invents a credential.
                </p>
                {highlightedChange?.occurredAt ? (
                  <p className="mt-3 mz-small mz-mono">
                    Latest change recorded {new Date(highlightedChange.occurredAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                ) : null}
              </div>
              <Link
                href={primaryAction.href}
                className="mz-btn min-h-12"
              >
                {primaryAction.label}
                <BriefcaseBusiness className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </Reveal>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <Reveal className="vh-scope vh-js relative overflow-hidden mz-glass p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mz-eyebrow">Readiness</p>
                <h2 className="mz-h2 mt-3">
                  {readiness?.readinessStatus ?? 'Readiness analysis in progress...'}
                </h2>
                <p className="mt-2 mz-small">
                  Last synced {new Date(data.refreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <div className="mz-glass-inset rounded-[8px] px-4 py-3 text-right">
                <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Trust</p>
                <p className="mt-2 text-2xl font-semibold mz-mono">
                  {readiness ? `${readiness.readinessScore}/100` : 'Pending'}
                </p>
                <p className="mt-1 mz-small">{readiness?.readinessLevel ?? 'Setup'}</p>
              </div>
            </div>

            {/* Vitals monitor — the clinical heartbeat of the readiness card,
                matching the public wallet's living-monitor language. */}
            <div className="vh-monitor mt-5">
              <svg viewBox="0 0 320 44" preserveAspectRatio="none">
                <path d={READINESS_EKG} />
                <path d={READINESS_EKG} transform="translate(160 0)" />
              </svg>
              <span aria-hidden="true" className="vh-monitor-beam" />
              <span className="vh-monitor-label">EVIDENCE · LIVE READ</span>
            </div>

            {/* Readiness meter — segmented clinical readout with a leading pulse,
                replacing the flat gradient bar. */}
            <div
              className="vh-bar mt-4"
              style={{ '--vh-bar': `${Math.max(8, readiness?.readinessScore ?? completeness)}%` } as React.CSSProperties}
            >
              <div className="vh-bar-fill" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="mz-inset mz-mono rounded-[2px] px-3 py-1 text-xs">
                {completedProfileChecks}/5 profile checks complete
              </span>
              <p className="mz-body">{readinessMomentum}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Active applications" value={`${data.activeApplications.length}`} />
              <MetricCard label="Available roles" value={`${data.availableOpportunities.length}`} />
              <MetricCard label="Unread updates" value={`${unreadNotifications.length}`} />
            </div>
          </Reveal>

          <Reveal delay={80} className="mz-glass p-5">
            <p className="mz-eyebrow">Momentum</p>
            <h2 className="mz-h2 mt-3">
              {readinessMomentum}
            </h2>
            <p className="mt-3 mz-body">
              {data.blockers[0]
                ? 'Resolve what is left and we will reflect the change in readiness, blockers, and any active applications.'
                : data.activeApplications[0]
                  ? 'Your application updates will continue to land here as the employer moves through review.'
                  : data.availableOpportunities[0]
                    ? 'You have live roles waiting when you are ready to apply.'
                    : 'Your workspace is set up and ready for the next update.'}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricCard label="What's left" value={`${data.blockers.length}`} />
              <MetricCard label="Since last visit" value={`${changesSinceLastVisit.length}`} />
            </div>
          </Reveal>
        </section>

        {/^\d{10}$/.test(npi) && (
          <Reveal>
            <RecognitionCard npi={npi} />
          </Reveal>
        )}

        <Reveal>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="mz-glass p-5">
              <p className="mz-eyebrow">What&apos;s left</p>
              {data.blockers.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.blockers.slice(0, 5).map((blocker) => (
                    <Link
                      key={blocker.id}
                      href={blocker.href}
                      className="block mz-glass-inset mz-glass-interactive rounded-[8px] px-4 py-3"
                    >
                      <p className="mz-h2">{blocker.title}</p>
                      <p className="mt-1 mz-body">{blocker.detail}</p>
                      <p className="mt-2">
                        <span className="mz-chip mz-chip-watch">
                          <span className="mz-gl" />
                          {blocker.nextActionLabel}
                        </span>
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 mz-body">Nothing is blocking your next step right now.</p>
              )}
            </div>

            <NotificationList
              notifications={visibleNotifications}
              maxItems={3}
              heading="Recent changes"
            />
          </section>
        </Reveal>

        <Reveal>
          <section className="mz-glass p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mz-eyebrow">Proof of progress</p>
                <h2 className="mz-h1 mt-3">Measured outcomes in your workspace</h2>
                <p className="mt-2 max-w-3xl mz-small">
                  These changes are tied to recorded readiness, blocker, and application updates only.
                </p>
              </div>
              {proof.readinessCurrentScore !== null ? (
                <div className="mz-glass-inset rounded-[8px] px-4 py-3 text-right">
                  <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Current readiness</p>
                  <p className="mt-2 text-2xl font-semibold mz-mono">
                    {proof.readinessCurrentLevel ?? 'L0'} · {proof.readinessCurrentScore}/100
                  </p>
                  <p className="mt-1 mz-small">
                    {proof.readinessDeltaScore === null
                      ? 'Baseline established'
                      : proof.readinessDeltaScore >= 0
                        ? `+${proof.readinessDeltaScore} from baseline`
                        : `${proof.readinessDeltaScore} from baseline`}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <MetricCard label="Blockers resolved" value={`${proof.blockersResolvedCount}`} />
              <MetricCard label="Applications submitted" value={`${proof.applicationsSubmitted}`} />
              <MetricCard label="Applications moving" value={`${proof.applicationsMoving}`} />
              <MetricCard
                label="Readiness change"
                value={proof.readinessDeltaScore === null
                  ? 'Baseline'
                  : proof.readinessDeltaScore >= 0
                    ? `+${proof.readinessDeltaScore}`
                    : `${proof.readinessDeltaScore}`}
              />
            </div>

            {proof.completedWithVitalCv.length > 0 ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {proof.completedWithVitalCv.map((item) => (
                  <div key={item} className="mz-inset px-4 py-3">
                    <p className="mz-body">{item}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 mz-inset px-4 py-3">
                <p className="mz-body">
                  Measured proof will appear here as soon as readiness, blockers, or applications change.
                </p>
              </div>
            )}

            {proof.recentChanges.length > 0 ? (
              <div className="mt-5 space-y-3">
                {proof.recentChanges.slice(0, 3).map((change) => (
                  <Link
                    key={change.id}
                    href={change.href}
                    className="block mz-glass-inset mz-glass-interactive rounded-[8px] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="mz-h2">{change.title}</p>
                        <p className="mt-1 mz-body">{change.summary}</p>
                      </div>
                      <p className="mz-small mz-mono">
                        {new Date(change.occurredAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </Reveal>

        <Reveal>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <ApplicationList
              applications={data.activeApplications}
              maxItems={2}
            />
            <OpportunityGrid
              opportunities={data.availableOpportunities}
              maxItems={2}
              heading="Opportunities available"
            />
          </section>
        </Reveal>

        <QuickActionGrid actions={quickActions} />

        <ClinicianSupportCard
          topic="clinician-home"
          detail="Need help? We're here to assist."
          primaryHref="/holder/readiness"
          primaryLabel="View readiness"
        />
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="mz-glass-inset rounded-[8px] px-4 py-3">
      <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">{label}</p>
      <p className="mt-2 text-lg font-semibold mz-mono">{value}</p>
    </div>
  );
}
