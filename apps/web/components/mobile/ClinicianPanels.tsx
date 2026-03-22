'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Clock4,
  Compass,
  MapPin,
  Stethoscope,
  type LucideIcon,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import ApplyModal from '@/components/explore/ApplyModal';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import type { ClinicianNotification } from '@/lib/mobile/clinician-state';
import {
  applicationStatusLabel,
  applicationStatusTone,
  type MobileApplication,
  type MobileOpportunityCard,
} from '@/lib/mobile/dashboard';

export interface MobileQuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: 'emerald' | 'sky' | 'amber' | 'zinc';
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Updated recently';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toneClasses(tone: ReturnType<typeof applicationStatusTone>): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    case 'sky':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
    case 'rose':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
    case 'zinc':
      return 'border-white/10 bg-white/5 text-white/70';
    case 'amber':
    default:
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
  }
}

function matchTone(opportunity: MobileOpportunityCard): string {
  if (opportunity.application) {
    return toneClasses(applicationStatusTone(opportunity.application.status));
  }

  switch (opportunity.match?.band) {
    case 'CLEAR':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    case 'NEAR_CLEAR':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
    case 'PARTIAL':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
    default:
      return 'border-white/10 bg-white/5 text-white/70';
  }
}

function matchLabel(opportunity: MobileOpportunityCard): string {
  if (opportunity.application) {
    return applicationStatusLabel(opportunity.application.status);
  }

  switch (opportunity.match?.band) {
    case 'CLEAR':
      return 'Clear to start';
    case 'NEAR_CLEAR':
      return 'Almost ready';
    case 'PARTIAL':
      return 'Partial fit';
    case 'INELIGIBLE':
      return 'Needs work';
    default:
      return 'Live role';
  }
}

function quickActionToneClasses(tone: MobileQuickAction['tone']): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-400/15 bg-emerald-400/10 text-emerald-50';
    case 'sky':
      return 'border-sky-400/15 bg-sky-400/10 text-sky-50';
    case 'amber':
      return 'border-amber-400/15 bg-amber-400/10 text-amber-50';
    case 'zinc':
    default:
      return 'border-white/10 bg-white/[0.05] text-white';
  }
}

export function OpportunityGrid({
  opportunities,
  heading,
  description,
  maxItems,
}: {
  opportunities: readonly MobileOpportunityCard[];
  heading?: string;
  description?: string;
  maxItems?: number;
}) {
  const { data, applySubmitted, selectOpportunity, selectedOpportunityId } = useClinicianMobile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const supportsApplyQuery = pathname === '/holder/opportunities';

  const visibleOpportunities = maxItems ? opportunities.slice(0, maxItems) : opportunities;
  const activeOpportunity = visibleOpportunities.find((opportunity) => opportunity.id === activeOpportunityId)
    ?? opportunities.find((opportunity) => opportunity.id === activeOpportunityId)
    ?? null;
  const existingApplication = activeOpportunity
    ? data.activeApplications.find((application) => application.opportunityId === activeOpportunity.id) ?? null
    : null;

  const updateApplyQuery = React.useCallback((opportunityId: string | null) => {
    if (!supportsApplyQuery) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (opportunityId) {
      params.set('apply', opportunityId);
    } else {
      params.delete('apply');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, supportsApplyQuery]);

  React.useEffect(() => {
    if (!supportsApplyQuery) {
      return;
    }

    const applyId = searchParams.get('apply');
    if (!applyId) {
      setActiveOpportunityId(null);
      return;
    }

    const target = opportunities.find((opportunity) => opportunity.id === applyId) ?? null;
    if (target) {
      setActiveOpportunityId((current) => (current === applyId ? current : applyId));
      selectOpportunity(applyId);
      return;
    }

    updateApplyQuery(null);
  }, [opportunities, searchParams, selectOpportunity, supportsApplyQuery, updateApplyQuery]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      {heading ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{heading}</p>
          </div>
          <Compass className="mt-0.5 h-5 w-5 text-white/45" />
        </div>
      ) : null}

      {visibleOpportunities.length > 0 ? (
        <div className="space-y-4">
          {visibleOpportunities.map((opportunity) => {
            const isSelected = selectedOpportunityId === opportunity.id;
            return (
              <article
                key={opportunity.id}
                className={`rounded-3xl border p-4 transition ${
                  isSelected
                    ? 'border-emerald-400/35 bg-emerald-400/10'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/opportunities/${encodeURIComponent(opportunity.id)}`}
                    onClick={() => selectOpportunity(opportunity.id)}
                    className="min-w-0 flex-1"
                  >
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50">
                      <Building2 className="h-3.5 w-3.5 opacity-60" />
                      {opportunity.organizationName}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white transition hover:text-emerald-200">
                      {opportunity.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/65">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{opportunity.state}</span>
                      <span className="opacity-40">·</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{opportunity.specialty}</span>
                      {opportunity.payRange ? (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-100/90"><Banknote className="h-3.5 w-3.5 opacity-70" />{opportunity.payRange}</span>
                        </>
                      ) : null}
                    </div>
                  </Link>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${matchTone(opportunity)}`}>
                    {matchLabel(opportunity)}
                  </span>
                </div>

                {opportunity.match?.fitReasons.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunity.match.fitReasons.slice(0, 3).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/80"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                {opportunity.match?.blockers.length ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Requirements remaining</p>
                    <ul className="mt-2 space-y-1.5">
                      {opportunity.match.blockers.slice(0, 2).map((blocker) => (
                        <li key={blocker.label} className="flex items-start gap-2 text-xs text-amber-50/80">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400/50" />
                          <span>{blocker.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock4 className="h-3.5 w-3.5 opacity-60" />
                    Updated {formatTimestamp(opportunity.createdAt)}
                  </span>
                  {opportunity.hiringType === 'PERMANENT' ? (
                    <span className="inline-flex items-center gap-1.5 text-sky-100/60">
                      <Users className="h-3.5 w-3.5 opacity-60" />
                      Direct Hire
                    </span>
                  ) : opportunity.hiringType === 'LOCUM_TENENS' ? (
                    <span className="inline-flex items-center gap-1.5 text-sky-100/60">
                      <Users className="h-3.5 w-3.5 opacity-60" />
                      Locums
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  {opportunity.application ? (
                    <Link
                      href={`/holder/applications/${encodeURIComponent(opportunity.application.id)}`}
                      onClick={() => selectOpportunity(opportunity.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                    >
                      View application
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void trackClinicianEventOncePerSession(`opportunity-view:${opportunity.id}`, 'clinician.opportunity_viewed', {
                          npi: data.workspace?.personProfile?.npi ?? null,
                          opportunityId: opportunity.id,
                          organizationId: opportunity.organizationId,
                          requirementLevel: opportunity.requirementLevel,
                        });
                        setActiveOpportunityId(opportunity.id);
                        selectOpportunity(opportunity.id);
                        updateApplyQuery(opportunity.id);
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                    >
                      Apply now
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    onClick={() => {
                      void trackClinicianEventOncePerSession(`opportunity-view:${opportunity.id}`, 'clinician.opportunity_viewed', {
                        npi: data.workspace?.personProfile?.npi ?? null,
                        opportunityId: opportunity.id,
                        organizationId: opportunity.organizationId,
                        requirementLevel: opportunity.requirementLevel,
                      });
                      selectOpportunity(opportunity.id);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    Role details
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="No matching roles available right now"
          detail="No live matches found for your current readiness profile."
          actionHref="/holder/readiness"
          actionLabel="View readiness"
        />
      )}

      {activeOpportunity ? (
        <ApplyModal
          opportunity={{
            id: activeOpportunity.id,
            title: activeOpportunity.title,
            specialty: activeOpportunity.specialty,
            hiringType: activeOpportunity.hiringType,
            state: activeOpportunity.state,
            organizationName: activeOpportunity.organizationName,
          }}
          existingApplication={existingApplication}
          onSubmitted={(application) => {
            applySubmitted(application);
          }}
          onClose={() => {
            setActiveOpportunityId(null);
            updateApplyQuery(null);
          }}
        />
      ) : null}
    </section>
  );
}

export function NotificationList({
  notifications,
  heading = 'Recent changes',
  description,
  maxItems,
  dismissible = false,
}: {
  notifications: readonly ClinicianNotification[];
  heading?: string;
  description?: string;
  maxItems?: number;
  dismissible?: boolean;
}) {
  const {
    dismissNotification,
    markNotificationRead,
    readNotificationIds,
  } = useClinicianMobile();
  const visibleNotifications = maxItems ? notifications.slice(0, maxItems) : notifications;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{heading}</p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
          ) : null}
        </div>
        <BellRing className="mt-0.5 h-5 w-5 text-white/45" />
      </div>

      {visibleNotifications.length > 0 ? (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`relative rounded-3xl border p-4 ${
                readNotificationIds.includes(notification.id)
                  ? 'border-white/10 bg-black/20'
                  : 'border-vt-info/30 bg-white/[0.07]'
              }`}
            >
              {!readNotificationIds.includes(notification.id) ? (
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-3xl bg-vt-info" />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{notification.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">{notification.body}</p>
                </div>
                {dismissible ? (
                  <button
                    type="button"
                    onClick={() => dismissNotification(notification.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label={`Dismiss ${notification.title}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-white/40">{formatTimestamp(notification.occurredAt)}</span>
                <Link
                  href={notification.href}
                  onClick={() => markNotificationRead(notification.id)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 transition hover:text-white"
                >
                  {notification.ctaLabel}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="You're all caught up"
          detail="Your notifications will appear here."
          actionHref="/holder/home"
          actionLabel="Return home"
        />
      )}
    </section>
  );
}

export function ApplicationList({
  applications,
  heading = 'Applications in motion',
  description,
  maxItems,
}: {
  applications: readonly MobileApplication[];
  heading?: string;
  description?: string;
  maxItems?: number;
}) {
  const visibleApplications = maxItems ? applications.slice(0, maxItems) : applications;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{heading}</p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
          ) : null}
        </div>
        <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-white/45" />
      </div>

      {visibleApplications.length > 0 ? (
        <div className="space-y-4">
          {visibleApplications.map((application) => (
            <article key={application.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    {application.employer.name ?? application.opportunity.organizationName ?? 'Employer context'}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{application.opportunity.title}</h3>
                  <p className="mt-2 text-sm text-white/65">
                    {application.opportunity.state} · {application.opportunity.specialty}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(applicationStatusTone(application.status))}`}>
                  {applicationStatusLabel(application.status)}
                </span>
              </div>

              <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Passport Attached</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {application.readiness?.readinessLevel ?? 'L0'}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/70">
                  {application.readiness?.readinessStatus ?? 'Your readiness will auto-refresh when reviewed.'}
                </p>
                {application.latestRecommendation?.label ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {application.latestRecommendation.label}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Updated {formatTimestamp(application.updatedAt)}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/holder/applications/${encodeURIComponent(application.id)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 transition hover:text-white"
                  >
                    View application
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/opportunities/${application.opportunity.id}`}
                    className="inline-flex items-center gap-1 text-sm text-white/55 transition hover:text-white"
                  >
                    <Building2 className="h-4 w-4" />
                    Role details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="No active applications"
          detail="You haven't applied to any roles yet."
          actionHref="/holder/opportunities"
          actionLabel="View opportunities"
        />
      )}
    </section>
  );
}

export function QuickActionGrid({ actions }: { actions: readonly MobileQuickAction[] }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Other actions</p>
        </div>
        <AlertTriangle className="mt-0.5 h-5 w-5 text-white/45" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className={`rounded-3xl border p-4 transition hover:border-white/20 ${quickActionToneClasses(action.tone)}`}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold">{action.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SelectedOpportunityBanner() {
  const { data, selectedOpportunityId } = useClinicianMobile();
  const selectedOpportunity = selectedOpportunityId
    ? data.opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? null
    : null;

  if (!selectedOpportunity) {
    return null;
  }

  const continueHref = selectedOpportunity.application
    ? `/holder/applications/${encodeURIComponent(selectedOpportunity.application.id)}`
    : `/holder/opportunities?apply=${encodeURIComponent(selectedOpportunity.id)}`;
  const continueLabel = selectedOpportunity.application ? 'View application' : 'Continue application';

  return (
    <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">Continuing where you left off</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{selectedOpportunity.title}</h2>
          <p className="mt-2 text-sm text-emerald-50/85">
            {selectedOpportunity.organizationName} · {selectedOpportunity.state}
          </p>
        </div>
        <Building2 className="mt-0.5 h-5 w-5 text-emerald-100/80" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={continueHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
        >
          {continueLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/opportunities/${selectedOpportunity.id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold text-white transition hover:border-white/20"
        >
          Open role details
        </Link>
      </div>
    </section>
  );
}
