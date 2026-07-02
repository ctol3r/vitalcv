'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import ApplyModal from '@/components/explore/ApplyModal';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  applicationStatusLabel,
  applicationStatusTone,
  buildMobileOpportunityCards,
  normalizeClinicianApplications,
  normalizeMatchPayload,
  normalizeMobileTrustState,
  upsertClinicianApplication,
  type MobileApplication,
  type MobileDashboardData,
  type MobileOpportunityCard,
} from '@/lib/mobile/dashboard';

type MobileTab = 'overview' | 'roles' | 'applications';

type ApplyOpportunity = {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  organizationName?: string;
};

interface OpportunityListPayload {
  opportunities?: OpportunitySummary[];
  total?: number;
}

interface MobileExperienceProps {
  initialData: MobileDashboardData;
  initialTab?: MobileTab;
}

const TAB_STORAGE_KEY = 'vitalcv.mobile.active-tab';
const CLIENT_ROUTE_TIMEOUT_MS = 10_000;

const TAB_META: Record<MobileTab, { label: string; icon: typeof Compass }> = {
  overview: { label: 'Overview', icon: UserRound },
  roles: { label: 'Roles', icon: Compass },
  applications: { label: 'Applications', icon: BriefcaseBusiness },
};

function safeDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toneClasses(tone: ReturnType<typeof applicationStatusTone>): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400';
    case 'sky':
      return 'border-sky-500/15 bg-sky-500/5 text-sky-400';
    case 'rose':
      return 'border-rose-500/15 bg-rose-500/5 text-rose-400';
    case 'zinc':
      return 'border-white/10 bg-white/5 text-white/50';
    case 'amber':
    default:
      return 'border-amber-500/15 bg-amber-500/5 text-amber-400';
  }
}

function readinessTone(level: string | null | undefined): string {
  switch (level) {
    case 'L3':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    case 'L2':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-400';
    case 'L1':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    case 'L0':
    default:
      return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
  }
}

function matchBandLabel(value: 'CLEAR' | 'NEAR_CLEAR' | 'PARTIAL' | 'INELIGIBLE'): string {
  switch (value) {
    case 'CLEAR':
      return 'Cleared to Apply';
    case 'NEAR_CLEAR':
      return 'High Fit';
    case 'PARTIAL':
      return 'Partial Fit';
    case 'INELIGIBLE':
      return 'Requirements Missing';
    default:
      return 'Live Role';
  }
}

async function loadRouteJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(CLIENT_ROUTE_TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status}).`);
  }

  return await response.json() as T;
}

async function refreshMobileDashboard(current: MobileDashboardData): Promise<MobileDashboardData> {
  const [workspaceResult, applicationsResult, opportunitiesResult] = await Promise.allSettled([
    current.signedIn ? loadRouteJson<{
      personProfile?: {
        npi?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        specialty?: string | null;
        stateOfPractice?: string | null;
        completeness?: number | null;
      } | null;
    }>('/api/me/workspaces') : Promise.resolve(null),
    current.signedIn ? loadRouteJson<unknown>('/api/clinician/applications') : Promise.resolve(null),
    loadRouteJson<OpportunityListPayload>('/api/opportunities?limit=24'),
  ]);

  const workspace = workspaceResult.status === 'fulfilled' && workspaceResult.value
    ? {
        personProfile: workspaceResult.value.personProfile
          ? {
              npi: workspaceResult.value.personProfile.npi ?? null,
              firstName: workspaceResult.value.personProfile.firstName ?? null,
              lastName: workspaceResult.value.personProfile.lastName ?? null,
              specialty: workspaceResult.value.personProfile.specialty ?? null,
              stateOfPractice: workspaceResult.value.personProfile.stateOfPractice ?? null,
              completeness:
                typeof workspaceResult.value.personProfile.completeness === 'number'
                  ? workspaceResult.value.personProfile.completeness
                  : null,
            }
          : null,
      }
    : current.workspace;

  const applications = applicationsResult.status === 'fulfilled'
    ? normalizeClinicianApplications(applicationsResult.value)
    : current.applications;

  const opportunityPayload = opportunitiesResult.status === 'fulfilled' && opportunitiesResult.value
    ? opportunitiesResult.value
    : { opportunities: current.opportunities };

  const npi = workspace?.personProfile?.npi ?? null;

  let trustState = current.trustState;
  let matchPayload = null;

  if (npi) {
    const [trustResult, matchResult] = await Promise.allSettled([
      loadRouteJson<unknown>(`/api/trust-state/${encodeURIComponent(npi)}`),
      loadRouteJson<unknown>(`/api/matcha/opportunities/${encodeURIComponent(npi)}`),
    ]);

    trustState = trustResult.status === 'fulfilled'
      ? normalizeMobileTrustState(trustResult.value)
      : current.trustState;
    matchPayload = matchResult.status === 'fulfilled'
      ? normalizeMatchPayload(matchResult.value)
      : null;
  }

  return {
    signedIn: current.signedIn,
    workspace,
    trustState,
    applications,
    opportunities: buildMobileOpportunityCards({
      opportunities: opportunityPayload.opportunities ?? [],
      applications,
      matchPayload,
      specialty: workspace?.personProfile?.specialty ?? null,
      state: workspace?.personProfile?.stateOfPractice ?? null,
    }),
    missingForHigherMatches: matchPayload?.missingForHigherMatches ?? current.missingForHigherMatches,
    refreshedAt: new Date().toISOString(),
  };
}

export default function MobileExperience({
  initialData,
  initialTab = 'overview',
}: MobileExperienceProps) {
  const [dashboard, setDashboard] = useState(initialData);
  const [activeTab, setActiveTab] = useState<MobileTab>(initialTab);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ApplyOpportunity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || initialTab !== 'overview') {
      return;
    }

    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (stored === 'overview' || stored === 'roles' || stored === 'applications') {
      setActiveTab(stored);
    }
  }, [initialTab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const personProfile = dashboard.workspace?.personProfile ?? null;
  const displayName = [personProfile?.firstName, personProfile?.lastName]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();
  const activeApplications = dashboard.applications.filter((application) => application.status !== 'WITHDRAWN');
  const selectedApplication = selectedOpportunity
    ? dashboard.applications.find((application) => application.opportunityId === selectedOpportunity.id) ?? null
    : null;

  const openApplyModal = (opportunity: MobileOpportunityCard) => {
    setSelectedOpportunity({
      id: opportunity.id,
      title: opportunity.title,
      specialty: opportunity.specialty,
      hiringType: opportunity.hiringType,
      state: opportunity.state,
      organizationName: opportunity.organizationName,
    });
  };

  const handleSubmittedApplication = (application: MobileApplication) => {
    setDashboard((current) => {
      const applications = upsertClinicianApplication(current.applications, application);
      return {
        ...current,
        applications,
        opportunities: current.opportunities.map((opportunity) => (
          opportunity.id === application.opportunityId
            ? { ...opportunity, application }
            : opportunity
        )),
      };
    });

    startTransition(() => {
      setActiveTab('applications');
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);

    try {
      const next = await refreshMobileDashboard(dashboard);
      setDashboard(next);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'System sync interrupted.');
    } finally {
      setRefreshing(false);
    }
  };

  const greetingTime = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.03),_transparent_30%),linear-gradient(180deg,_#030712,_#020617)] text-white selection:bg-white/20">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-6 sm:max-w-5xl sm:px-6 lg:px-8">
        
        <header className="flex items-center justify-between pb-6 pt-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/80">Trust Workspace Active</p>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white/90">
              {displayName ? `${greetingTime}, ${displayName.split(' ')[0]}` : 'VitalCV Workspace'}
            </h1>
            <p className="mt-1 text-xs text-white/40">
              Last synced: {safeDateLabel(dashboard.refreshedAt)}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </header>

        {refreshError ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 shadow-sm">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <p className="font-medium">{refreshError}</p>
          </div>
        ) : null}

        <div className="hidden grid-cols-3 gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-1.5 sm:grid">
          {(Object.keys(TAB_META) as MobileTab[]).map((tab) => {
            const Icon = TAB_META[tab].icon;
            const active = activeTab === tab;

            return (
              <motion.button
                whileTap={{ scale: 0.98 }}
                key={tab}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setActiveTab(tab);
                  });
                }}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                <Icon className="h-4 w-4" />
                {TAB_META[tab].label}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-5 flex-1"
          >
            {activeTab === 'overview' ? (
              <div className="space-y-4">
                
                {/* ACTIONABLE BLOCK: Top Missing Component for Momentum Framing */}
                {dashboard.missingForHigherMatches.length > 0 && dashboard.signedIn ? (
                  <motion.div 
                    whileTap={{ scale: 0.99 }}
                    className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-500/5 p-5 shadow-[0_8px_30px_-12px_rgba(14,165,233,0.15)] transition-colors hover:border-sky-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-sky-400" />
                        <h3 className="text-sm font-semibold text-sky-100">Unlock Higher Match Scores</h3>
                      </div>
                      <ChevronRight className="h-4 w-4 text-sky-400/50 transition-transform group-hover:translate-x-1 group-hover:text-sky-400" />
                    </div>
                    <p className="mt-2 pr-6 text-sm leading-relaxed text-sky-200/80">
                      Providing your{' '}
                      <span className="font-medium text-sky-100">{dashboard.missingForHigherMatches.slice(0, 2).join(', ')}</span> 
                      {' '}immediately clears you for higher-paying tier-1 roles.
                    </p>
                  </motion.div>
                ) : null}

                {/* TRUST & READINESS COMPONENT */}
                <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${readinessTone(dashboard.trustState?.readinessLevel)}`}>
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white/90">Readiness</h2>
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
                          {dashboard.trustState?.readinessStatus ?? 'Pending Verification'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${readinessTone(dashboard.trustState?.readinessLevel)}`}>
                        {dashboard.trustState?.readinessLevel ?? 'Setup'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(5, dashboard.trustState?.readinessScore ?? 10)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400"
                    />
                  </div>
                  
                  <div className="mt-4">
                    {(dashboard.trustState?.gapSummary.length ?? 0) > 0 ? (
                      <div className="space-y-2.5">
                        {dashboard.trustState?.gapSummary.slice(0, 2).map((gap) => (
                          <div key={gap} className="flex items-start gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/5 px-4 py-3 text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
                            <div className="flex-1">
                              <p className="font-medium text-amber-100">Action Required</p>
                              <p className="mt-0.5 text-xs leading-5 text-amber-200/70">{gap}</p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 text-amber-500/40" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <p className="font-medium text-emerald-100">Source Checks Current</p>
                        </div>
                        <p className="mt-1 text-xs text-emerald-200/70">
                          Ready for review where source coverage is complete.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* STATS COMPONENT */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Opportunities</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{dashboard.opportunities.length}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-white/40">
                      <Activity className="h-3 w-3" /> Live Matches
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Applied</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{activeApplications.length}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-white/40">
                      <ChartIcon className="h-3 w-3" /> In Progress
                    </p>
                  </div>
                </div>

                {/* ACTIVE APPLICATION SUMMARY */}
                {activeApplications[0] ? (
                  <motion.section 
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startTransition(() => setActiveTab('applications'))}
                    className="cursor-pointer rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-sm transition hover:border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">Latest Submission</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses(applicationStatusTone(activeApplications[0].status))}`}>
                        {applicationStatusLabel(activeApplications[0].status)}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-base font-medium text-white/90">
                      {activeApplications[0].opportunity.title}
                    </h3>
                    <p className="text-sm text-white/50">
                      {activeApplications[0].employer.name ?? activeApplications[0].opportunity.organizationName ?? 'Employer Review'}
                    </p>
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Trust snapshot securely attached.
                    </div>
                  </motion.section>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'roles' ? (
              <div className="space-y-4">
                <section className="mb-6 px-1">
                  <h2 className="text-xl font-medium tracking-tight text-white/90">
                    Live Roles
                  </h2>
                  <p className="mt-1 text-sm text-white/40">
                    Live matches. No forms to fill.
                  </p>
                </section>

                {dashboard.opportunities.length > 0 ? dashboard.opportunities.map((opportunity) => (
                  <RoleCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onApply={() => openApplyModal(opportunity)}
                  />
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03]">
                      <Compass className="h-5 w-5 text-white/40" />
                    </div>
                    <p className="mt-4 text-sm text-white/60">No roles match your current readiness. Check back soon.</p>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'applications' ? (
              <div className="space-y-4">
                <section className="mb-6 px-1">
                  <h2 className="text-xl font-medium tracking-tight text-white/90">
                    Application Desk
                  </h2>
                  <p className="mt-1 text-sm text-white/40">
                    Lifecycle tracking.
                  </p>
                </section>

                {activeApplications.length > 0 ? activeApplications.map((application) => (
                  <ApplicationCard key={application.id} application={application} />
                )) : (
                  <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/[0.05] bg-white/[0.02] py-10 text-center">
                    <BriefcaseBusiness className="h-8 w-8 text-white/20" />
                    <p className="mt-4 text-sm text-white/60">No active applications.</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => startTransition(() => setActiveTab('roles'))}
                      className="mt-6 flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      Browse matching roles
                    </motion.button>
                  </div>
                )}
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#020617]/80 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-md w-full justify-between">
          {(Object.keys(TAB_META) as MobileTab[]).map((tab) => {
            const Icon = TAB_META[tab].icon;
            const active = activeTab === tab;

            return (
              <motion.button
                whileTap={{ scale: 0.92 }}
                key={tab}
                onClick={() => startTransition(() => setActiveTab(tab))}
                className="group relative flex w-[30%] flex-col items-center justify-center gap-1.5 py-1"
              >
                <div className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-colors duration-300 ${active ? 'bg-white/10' : 'bg-transparent'}`}>
                  <Icon className={`h-[18px] w-[18px] transition-colors duration-300 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} />
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-300 ${active ? 'text-white/90' : 'text-white/40 group-hover:text-white/70'}`}>
                  {TAB_META[tab].label}
                </span>
                {active && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute -top-3 h-0.5 w-6 rounded-full bg-white" 
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {selectedOpportunity ? (
          <ApplyModal
            opportunity={selectedOpportunity}
            existingApplication={selectedApplication}
            onSubmitted={handleSubmittedApplication}
            onClose={() => setSelectedOpportunity(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ChartIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      {...props}
    >
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  );
}

function RoleCard({
  opportunity,
  onApply,
}: {
  opportunity: MobileOpportunityCard;
  onApply: () => void;
}) {
  const application = opportunity.application;
  const statusTone = application ? toneClasses(applicationStatusTone(application.status)) : null;

  return (
    <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-sm transition hover:border-white/[0.12]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
            {opportunity.organizationName}
          </p>
          <h3 className="mt-1.5 text-lg font-medium tracking-tight text-white/90">{opportunity.title}</h3>
          <p className="mt-1 text-sm text-white/50">
            {opportunity.remote ? `Remote · ${opportunity.state}` : opportunity.state} · {opportunity.specialty}
          </p>
        </div>
        {application ? (
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${statusTone}`}>
            {applicationStatusLabel(application.status)}
          </span>
        ) : opportunity.match ? (
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${readinessTone(opportunity.match.band === 'CLEAR' ? 'L3' : opportunity.match.band === 'NEAR_CLEAR' ? 'L2' : opportunity.match.band === 'PARTIAL' ? 'L1' : 'L0')}`}>
            {matchBandLabel(opportunity.match.band)}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm text-white/70">
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
          <FileText className="h-3.5 w-3.5 text-white/30" />
          <span className="font-medium text-white/80">{opportunity.payRange ?? 'TBD'}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
          <Clock className="h-3.5 w-3.5 text-white/30" />
          <span className="font-medium capitalize text-white/80">{opportunity.hiringType.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {opportunity.match && !application ? (
        <div className="mt-4 rounded-[16px] border border-emerald-500/10 bg-emerald-500/5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-100/90">Signal Match</p>
            </div>
            <p className="text-sm font-semibold text-emerald-400">{opportunity.match.score}</p>
          </div>
          {opportunity.match.blockers.length > 0 ? (
             <div className="mt-3 space-y-1.5 border-t border-emerald-500/10 pt-3">
               {opportunity.match.blockers.slice(0, 2).map((blocker) => (
                 <p key={blocker.label} className="text-xs text-amber-200/80">
                   • {blocker.label}
                 </p>
               ))}
             </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href={`/holder/opportunities/${opportunity.id}`}
          className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
        >
          Details
        </Link>
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onApply}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-slate-950 transition-colors hover:bg-white/90"
        >
          {application ? 'View Progress' : 'One-Tap Apply'}
        </motion.button>
      </div>
    </article>
  );
}

function ApplicationCard({ application }: { application: MobileApplication }) {
  const isActionNeeded = application.status === 'NEEDS_INFO' || application.status === 'OFFER_MADE';
  const isActiveOrClosed = application.status === 'HIRED' || application.status === 'REJECTED' || application.status === 'WITHDRAWN';

  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-sm transition hover:border-white/[0.12]">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="pr-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
            {application.employer.name ?? application.opportunity.organizationName ?? 'Employer Review'}
          </p>
          <h3 className="mt-1.5 text-lg font-medium tracking-tight text-white/90">{application.opportunity.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${toneClasses(applicationStatusTone(application.status))}`}>
          {applicationStatusLabel(application.status)}
        </span>
      </div>

      {/* Structured Next Steps / Waiting on */}
      <div className="mt-5 rounded-[16px] border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
            {isActionNeeded ? (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            ) : isActiveOrClosed ? (
              <CheckCircle2 className="h-4 w-4 text-zinc-400" />
            ) : (
              <Clock className="h-4 w-4 text-sky-400" />
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
              {isActionNeeded ? 'Waiting on you' : isActiveOrClosed ? 'Completed' : 'Waiting on them'}
            </p>
            <p className="mt-0.5 text-sm font-medium text-white/80">
              {isActionNeeded ? 'Additional information required' : isActiveOrClosed ? 'Application closed' : 'Under active review'}
            </p>
          </div>
        </div>

        {/* Payload / Credentials verification proof */}
        <div className="ml-4 mt-3 border-l-2 border-white/5 pl-4 pt-1">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust snapshot delivered ({application.readiness?.readinessLevel ?? 'L0'})
          </div>
          {application.readiness?.trustSignals.length ? (
            <p className="mt-1.5 text-[11px] text-white/40">
              Included: {application.readiness.trustSignals.slice(0, 3).join(', ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">
        <span>Moved {safeDateLabel(application.updatedAt)}</span>
        <button type="button" className="inline-flex items-center gap-1 text-white/60 transition hover:text-white">
          History <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}
