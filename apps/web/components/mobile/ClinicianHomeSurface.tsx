'use client';

/**
 * ClinicianHomeSurface — the clinician home, recomposed (A3, 2026-08-08).
 *
 * The audit plan's strict hierarchy, in order: status since last visit → one
 * next action → the work ledger (real recorded events only) → what is waiting
 * on you or on someone else → the relevant application and role. Everything
 * else is a contextual link, not a widget.
 *
 * Retired from the default home by the same ruling: the MATCHA compass and
 * activity cards, the illustrative career graph, the decorative EKG "live
 * read" monitor, the padded readiness bar (it drew a floor under an absent
 * score), the Momentum and Proof-of-progress metric grids, and the
 * eight-card action grid. No metric renders here unless it was actually
 * computed from returned evidence and is explained where it appears.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CircleCheck,
  CircleDot,
  Clock,
  RefreshCw,
  Share2,
  Wallet,
} from 'lucide-react';
import {
  ApplicationList,
  OpportunityGrid,
  SelectedOpportunityBanner,
} from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { Reveal } from '@/components/motion/Reveal';
import { FEATURES } from '@/lib/features';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { formatEventTimestamp } from '@/lib/mobile/formatEventTimestamp';
import { buildWorkLedger, type LedgerEntry } from '@/lib/mobile/work-ledger';

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

/** Glyph per ledger state — always paired with the word, never color or shape alone (EC-4). */
function LedgerGlyph({ state }: { state: LedgerEntry['state'] }) {
  if (state === 'did' || state === 'finished') {
    return <CircleCheck className="h-4 w-4 flex-none" aria-hidden="true" />;
  }
  if (state === 'employer') {
    return <Clock className="h-4 w-4 flex-none" aria-hidden="true" />;
  }
  return <CircleDot className="h-4 w-4 flex-none" aria-hidden="true" />;
}

const CONTEXT_LINKS: Array<{ label: string; href: string; gated?: 'matcha' }> = [
  { label: 'Readiness', href: '/holder/readiness' },
  { label: 'Wallet', href: '/holder' },
  { label: 'Career scoreboard', href: '/holder/scoreboard' },
  { label: 'Career timeline', href: '/holder/timeline' },
  { label: 'Your Career DNA', href: '/holder/matcha', gated: 'matcha' },
  { label: 'Settings', href: '/holder/settings' },
];

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
  const profile = data.workspace?.personProfile;
  const npi = profile?.npi ?? 'unknown';
  const hasValidNpi = /^\d{10}$/.test(npi);
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || 'Your VitalCV profile';
  // Share the real, public, source-backed proof (what an employer actually
  // reads). Falls back to the wallet when no NPI is bound yet.
  const shareHref = hasValidNpi ? `/verify/${npi}` : '/holder';
  const previousVisitMs = previousVisitAt ? Date.parse(previousVisitAt) : 0;
  // Standing states (missing items) are not changes — they are stamped with
  // the request clock and would report "5 changes" to an account where
  // nothing has ever happened. They render once, under Waiting.
  const eventNotifications = visibleNotifications.filter(
    (notification) => notification.type !== 'missing_item_detected',
  );
  const changesSinceLastVisit = previousVisitMs > 0
    ? eventNotifications.filter((notification) => Date.parse(notification.occurredAt) > previousVisitMs)
    : [];
  const highlightedChange = changesSinceLastVisit[0] ?? null;
  const ledger = buildWorkLedger(data);
  const refreshedAtLabel = new Date(data.refreshedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const primaryAction = resume
    ? {
        eyebrow: 'Continue',
        title: resume.title,
        detail: 'Pick up where you left off without losing progress.',
        href: resume.href,
        label: 'Continue',
      }
    : {
        eyebrow: data.recommendedAction?.kind === 'finish_onboarding' ? 'Start here' : 'Next step',
        title: data.recommendedAction?.title ?? 'Open your readiness',
        detail: data.recommendedAction?.description ?? 'Keep your source-backed identity ready to share.',
        href: data.recommendedAction?.href ?? '/holder',
        label: data.recommendedAction?.ctaLabel ?? 'Open',
      };

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
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              Your VitalCV profile
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
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {hasValidNpi ? 'Share / prove' : 'Set up sharing'}
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="mz-btn mz-btn-ghost min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </Reveal>

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

        {/* 1 — Status since your last visit. Counts only recorded notifications
            newer than the prior visit; when nothing changed, it says so. */}
        <Reveal>
          <section aria-labelledby="home-since-heading" className="mz-glass p-5">
            <p id="home-since-heading" className="mz-eyebrow">Since your last visit</p>
            {changesSinceLastVisit.length > 0 ? (
              <div className="mt-3">
                <p className="mz-h2">
                  {changesSinceLastVisit.length} recorded change{changesSinceLastVisit.length === 1 ? '' : 's'}
                </p>
                {highlightedChange ? (
                  <p className="mt-1 mz-body">
                    Latest: {highlightedChange.title}
                    <span className="mz-small mz-mono">
                      {/* formatEventTimestamp includes the year — a stale
                          March event must never pass as fresh (#1214). */}
                      {' '}· {formatEventTimestamp(highlightedChange.occurredAt)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 mz-body">
                Nothing new was recorded since your last visit. State refreshed {refreshedAtLabel}.
              </p>
            )}
          </section>
        </Reveal>

        {/* 2 — One next action. */}
        <Reveal>
          <section aria-labelledby="home-next-heading" className="mz-glass-strong mz-glass-interactive p-5">
            <p className="mz-eyebrow">
              {primaryAction.eyebrow}
            </p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h2 id="home-next-heading" className="mz-h1">
                  <span className="mz-accent">{primaryAction.title}</span>
                </h2>
                <p className="mt-2 mz-body">
                  {primaryAction.detail}
                </p>
              </div>
              <Link
                href={primaryAction.href}
                className="mz-btn min-h-12"
              >
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </Reveal>

        {/* 3 — The work ledger: recorded events only, owner-labeled. */}
        <Reveal>
          <section aria-labelledby="home-ledger-heading" className="mz-glass p-5">
            <p id="home-ledger-heading" className="mz-eyebrow">What happened in your workspace</p>
            {ledger.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {ledger.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="block mz-glass-inset mz-glass-interactive rounded-[8px] px-4 py-3"
                      >
                        <LedgerRow item={item} />
                      </Link>
                    ) : (
                      <div className="mz-glass-inset rounded-[8px] px-4 py-3">
                        <LedgerRow item={item} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 mz-body">
                {hasValidNpi
                  ? 'No recorded activity yet. Events land here when something actually happens — never before.'
                  : 'Connect your NPI and recorded work will land here as it happens.'}
              </p>
            )}
          </section>
        </Reveal>

        {/* 4 — Waiting: what needs you, what someone else controls. */}
        <Reveal>
          <section aria-labelledby="home-waiting-heading" className="mz-glass p-5">
            <p id="home-waiting-heading" className="mz-eyebrow">Waiting</p>
            {data.blockers.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.blockers.slice(0, 5).map((blocker) => (
                  <Link
                    key={blocker.id}
                    href={blocker.href}
                    className="block mz-glass-inset mz-glass-interactive rounded-[8px] px-4 py-3"
                  >
                    <p className="mz-small mz-mono uppercase tracking-[0.14em]">Needs you</p>
                    <p className="mt-1 mz-h2">{blocker.title}</p>
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
              <p className="mt-4 mz-body">Nothing is waiting on you right now.</p>
            )}
          </section>
        </Reveal>

        {/* 5 — The relevant application and role. */}
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

        {/* Contextual destinations — quiet links, not widgets. */}
        <nav aria-label="More in your workspace" className="mz-glass p-5">
          <p className="mz-eyebrow">More in your workspace</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {CONTEXT_LINKS.filter((link) => link.gated !== 'matcha' || FEATURES.MATCHA_V2).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="mz-body underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

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

function LedgerRow({ item }: { item: LedgerEntry }) {
  return (
    <div className="flex items-start gap-3">
      <LedgerGlyph state={item.state} />
      <div className="min-w-0">
        <p className="mz-small mz-mono uppercase tracking-[0.14em]">{item.word}</p>
        <p className="mt-1 mz-h2">{item.title}</p>
        <p className="mt-1 mz-body">{item.consequence}</p>
        <p className="mt-1 mz-small mz-mono">
          {formatEventTimestamp(item.occurredAt)}
        </p>
      </div>
    </div>
  );
}
