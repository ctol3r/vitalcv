/**
 * Wave 194 — Marketplace Analytics Engine
 *
 * Instruments all Juggernaut funnels:
 *   - Explore → Prequalify
 *   - Resume/NPI bootstrap completion
 *   - Interview / Assessment
 *   - Search → Answer → Action
 *   - Opportunity click → Apply/Share
 *   - Referral link → Signup → Work
 *
 * Plus employer intelligence, search, and MATCHA metrics.
 * In-memory accumulator — Wave 195+ exports to persistent store.
 */

// ── Event catalog ─────────────────────────────────────────────────────────────

export type AnalyticsEventName =
  // Explore funnel
  | 'explore.viewed'
  | 'explore.opportunity_clicked'
  | 'explore.filter_applied'
  | 'explore.prequalify_triggered'
  // Onboarding funnel
  | 'onboarding.resume_uploaded'
  | 'onboarding.npi_bootstrapped'
  | 'onboarding.work_auth_complete'
  | 'onboarding.interview_complete'
  | 'onboarding.assessment_complete'
  | 'onboarding.prequalified'
  // Search funnel
  | 'search.query_submitted'
  | 'search.answer_accepted'
  | 'search.answer_reformulated'
  | 'search.source_clicked'
  | 'search.no_result'
  // Opportunity funnel
  | 'opportunity.viewed'
  | 'opportunity.applied'
  | 'opportunity.shared'
  | 'opportunity.instant_offer_opened'
  | 'opportunity.instant_offer_accepted'
  | 'opportunity.instant_offer_declined'
  // Employer funnel
  | 'employer.page_viewed'
  | 'employer.compared'
  | 'employer.ask_query'
  | 'employer.opportunity_clicked'
  // Referral funnel
  | 'referral.link_created'
  | 'referral.link_clicked'
  | 'referral.signup_attributed'
  | 'referral.prequalification_attributed'
  | 'referral.work_completed'
  // MATCHA
  | 'matcha.scored'
  | 'matcha.instant_offer_eligible'
  | 'matcha.blocker_recorded'
  // Clinician mobile launch funnel
  | 'clinician.sign_in'
  | 'clinician.onboarding_started'
  | 'clinician.onboarding_completed'
  | 'clinician.readiness_viewed'
  | 'clinician.blocker_opened'
  | 'clinician.blocker_resolved'
  | 'clinician.opportunity_viewed'
  | 'clinician.apply_started'
  | 'clinician.apply_submitted'
  | 'clinician.application_detail_viewed'
  | 'clinician.alert_viewed'
  | 'clinician.application_status_viewed'
  | 'clinician.wallet_viewed';

export interface AnalyticsEvent {
  eventId: string;
  name: AnalyticsEventName;
  npi?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
  ts: string;
}

// ── Aggregated counters ───────────────────────────────────────────────────────

interface FunnelMetrics {
  exploreViews: number;
  prequalifyStarts: number;
  onboardingCompletes: number;    // reached PREQUALIFIED
  searchQueries: number;
  searchAnswersAccepted: number;
  searchNoResults: number;
  opportunityClicks: number;
  opportunityApplications: number;
  instantOffersSent: number;
  instantOffersAccepted: number;
  referralLinks: number;
  referralSignups: number;
  referralPlacements: number;
  employerPageViews: number;
  matchaDecisions: number;
  instantOfferEligibleCount: number;
  blockerRecords: number;
  clinicianSignIns: number;
  clinicianOnboardingStarts: number;
  clinicianOnboardingCompletes: number;
  clinicianReadinessViews: number;
  clinicianBlockerOpens: number;
  clinicianBlockerResolutions: number;
  clinicianOpportunityViews: number;
  clinicianApplyStarts: number;
  clinicianApplySubmits: number;
  clinicianApplicationDetailViews: number;
  clinicianAlertViews: number;
  clinicianApplicationStatusViews: number;
  clinicianWalletViews: number;
}

const counters: FunnelMetrics = {
  exploreViews: 0, prequalifyStarts: 0, onboardingCompletes: 0,
  searchQueries: 0, searchAnswersAccepted: 0, searchNoResults: 0,
  opportunityClicks: 0, opportunityApplications: 0,
  instantOffersSent: 0, instantOffersAccepted: 0,
  referralLinks: 0, referralSignups: 0, referralPlacements: 0,
  employerPageViews: 0,
  matchaDecisions: 0, instantOfferEligibleCount: 0, blockerRecords: 0,
  clinicianSignIns: 0,
  clinicianOnboardingStarts: 0,
  clinicianOnboardingCompletes: 0,
  clinicianReadinessViews: 0,
  clinicianBlockerOpens: 0,
  clinicianBlockerResolutions: 0,
  clinicianOpportunityViews: 0,
  clinicianApplyStarts: 0,
  clinicianApplySubmits: 0,
  clinicianApplicationDetailViews: 0,
  clinicianAlertViews: 0,
  clinicianApplicationStatusViews: 0,
  clinicianWalletViews: 0,
};

// Blocker frequency for MATCHA analytics
const blockerFreq: Record<string, number> = {};
// Query log for search analytics
const queryLog: Array<{ query: string; hasAnswer: boolean; reformulated: boolean; ts: string }> = [];

// ── Event emission ────────────────────────────────────────────────────────────

export function emit(name: AnalyticsEventName, props: Record<string, unknown> = {}): void {
  const event: AnalyticsEvent = {
    eventId: Math.random().toString(36).slice(2),
    name,
    npi: props.npi as string | undefined,
    sessionId: props.sessionId as string | undefined,
    properties: props,
    ts: new Date().toISOString(),
  };

  // Accumulate counters
  switch (name) {
    case 'explore.viewed':           counters.exploreViews++; break;
    case 'explore.prequalify_triggered': counters.prequalifyStarts++; break;
    case 'onboarding.prequalified':  counters.onboardingCompletes++; break;
    case 'search.query_submitted':   counters.searchQueries++; queryLog.push({ query: props.query as string ?? '', hasAnswer: false, reformulated: false, ts: event.ts }); break;
    case 'search.answer_accepted':   counters.searchAnswersAccepted++; if (queryLog.length) queryLog[queryLog.length - 1].hasAnswer = true; break;
    case 'search.no_result':         counters.searchNoResults++; break;
    case 'search.answer_reformulated': if (queryLog.length) queryLog[queryLog.length - 1].reformulated = true; break;
    case 'opportunity.viewed':       counters.opportunityClicks++; break;
    case 'opportunity.applied':      counters.opportunityApplications++; break;
    case 'opportunity.instant_offer_opened': counters.instantOffersSent++; break;
    case 'opportunity.instant_offer_accepted': counters.instantOffersAccepted++; break;
    case 'referral.link_created':    counters.referralLinks++; break;
    case 'referral.signup_attributed': counters.referralSignups++; break;
    case 'referral.work_completed':  counters.referralPlacements++; break;
    case 'employer.page_viewed':     counters.employerPageViews++; break;
    case 'matcha.scored':            counters.matchaDecisions++; break;
    case 'matcha.instant_offer_eligible': counters.instantOfferEligibleCount++; break;
    case 'matcha.blocker_recorded': {
      const blocker = props.blocker as string ?? 'unknown';
      blockerFreq[blocker] = (blockerFreq[blocker] ?? 0) + 1;
      counters.blockerRecords++;
      break;
    }
    case 'clinician.sign_in': counters.clinicianSignIns++; break;
    case 'clinician.onboarding_started': counters.clinicianOnboardingStarts++; break;
    case 'clinician.onboarding_completed': counters.clinicianOnboardingCompletes++; break;
    case 'clinician.readiness_viewed': counters.clinicianReadinessViews++; break;
    case 'clinician.blocker_opened': counters.clinicianBlockerOpens++; break;
    case 'clinician.blocker_resolved': counters.clinicianBlockerResolutions++; break;
    case 'clinician.opportunity_viewed': counters.clinicianOpportunityViews++; break;
    case 'clinician.apply_started': counters.clinicianApplyStarts++; break;
    case 'clinician.apply_submitted': counters.clinicianApplySubmits++; break;
    case 'clinician.application_detail_viewed': counters.clinicianApplicationDetailViews++; break;
    case 'clinician.alert_viewed': counters.clinicianAlertViews++; break;
    case 'clinician.application_status_viewed': counters.clinicianApplicationStatusViews++; break;
    case 'clinician.wallet_viewed': counters.clinicianWalletViews++; break;
  }

  // Structured log (production → telemetry pipeline)
  console.log(JSON.stringify({ analytics: true, ...event }));
}

// ── Dashboard snapshots ───────────────────────────────────────────────────────

export function getFunnelReport() {
  const onboardingRate = counters.prequalifyStarts > 0
    ? Math.round((counters.onboardingCompletes / counters.prequalifyStarts) * 100)
    : 0;

  const searchSuccessRate = counters.searchQueries > 0
    ? Math.round((counters.searchAnswersAccepted / counters.searchQueries) * 100)
    : 0;

  const noResultRate = counters.searchQueries > 0
    ? Math.round((counters.searchNoResults / counters.searchQueries) * 100)
    : 0;

  const offerAcceptRate = counters.instantOffersSent > 0
    ? Math.round((counters.instantOffersAccepted / counters.instantOffersSent) * 100)
    : 0;

  const referralConversion = counters.referralSignups > 0
    ? Math.round((counters.referralPlacements / counters.referralSignups) * 100)
    : 0;
  const clinicianOnboardingCompletionRate = counters.clinicianOnboardingStarts > 0
    ? Math.round((counters.clinicianOnboardingCompletes / counters.clinicianOnboardingStarts) * 100)
    : 0;
  const clinicianApplyConversionRate = counters.clinicianApplyStarts > 0
    ? Math.round((counters.clinicianApplySubmits / counters.clinicianApplyStarts) * 100)
    : 0;
  const clinicianBlockerResolutionRate = counters.clinicianBlockerOpens > 0
    ? Math.round((counters.clinicianBlockerResolutions / counters.clinicianBlockerOpens) * 100)
    : 0;

  return {
    funnels: {
      explore: {
        views: counters.exploreViews,
        prequalifyStarts: counters.prequalifyStarts,
        completions: counters.onboardingCompletes,
        completionRate: `${onboardingRate}%`,
      },
      search: {
        queries: counters.searchQueries,
        answersAccepted: counters.searchAnswersAccepted,
        successRate: `${searchSuccessRate}%`,
        noResultRate: `${noResultRate}%`,
      },
      opportunities: {
        clicks: counters.opportunityClicks,
        applications: counters.opportunityApplications,
        conversionRate: counters.opportunityClicks > 0
          ? `${Math.round((counters.opportunityApplications / counters.opportunityClicks) * 100)}%`
          : '0%',
      },
      instantOffers: {
        sent: counters.instantOffersSent,
        accepted: counters.instantOffersAccepted,
        acceptRate: `${offerAcceptRate}%`,
      },
      referrals: {
        linksCreated: counters.referralLinks,
        signups: counters.referralSignups,
        placements: counters.referralPlacements,
        conversionRate: `${referralConversion}%`,
      },
    },
    employer: {
      pageViews: counters.employerPageViews,
    },
    matcha: {
      decisions: counters.matchaDecisions,
      instantOfferEligible: counters.instantOfferEligibleCount,
      topBlockers: Object.entries(blockerFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([blocker, count]) => ({ blocker, count })),
    },
    clinicianLaunch: {
      signIns: counters.clinicianSignIns,
      onboardingStarts: counters.clinicianOnboardingStarts,
      onboardingCompletes: counters.clinicianOnboardingCompletes,
      onboardingCompletionRate: `${clinicianOnboardingCompletionRate}%`,
      readinessViews: counters.clinicianReadinessViews,
      blockerOpens: counters.clinicianBlockerOpens,
      blockerResolutions: counters.clinicianBlockerResolutions,
      blockerResolutionRate: `${clinicianBlockerResolutionRate}%`,
      opportunityViews: counters.clinicianOpportunityViews,
      applyStarts: counters.clinicianApplyStarts,
      applySubmits: counters.clinicianApplySubmits,
      applyConversionRate: `${clinicianApplyConversionRate}%`,
      applicationDetailViews: counters.clinicianApplicationDetailViews,
      alertViews: counters.clinicianAlertViews,
      applicationStatusViews: counters.clinicianApplicationStatusViews,
      walletViews: counters.clinicianWalletViews,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function getSearchAnalytics() {
  const recent = queryLog.slice(-100);
  const withAnswer = recent.filter(q => q.hasAnswer).length;
  const reformulated = recent.filter(q => q.reformulated).length;
  return {
    totalQueries: counters.searchQueries,
    recentSample: recent.length,
    answerRate: recent.length > 0 ? `${Math.round((withAnswer / recent.length) * 100)}%` : '0%',
    reformulationRate: recent.length > 0 ? `${Math.round((reformulated / recent.length) * 100)}%` : '0%',
    noResultRate: counters.searchQueries > 0
      ? `${Math.round((counters.searchNoResults / counters.searchQueries) * 100)}%` : '0%',
    generatedAt: new Date().toISOString(),
  };
}
