import type { ClinicianMobileData, MobileTrustHistoryEntry } from '@/lib/mobile/clinician-state';
import type { MobileApplication } from '@/lib/mobile/dashboard';
import type { ClinicianProofPayload, EmployerValueSignals, OutcomeStateChange } from '@/lib/proof/types';

export interface ProofChange {
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  href: string;
}

export interface ClinicianProofViewModel {
  blockersResolvedCount: number;
  readinessBaselineScore: number | null;
  readinessCurrentScore: number | null;
  readinessBaselineLevel: string | null;
  readinessCurrentLevel: string | null;
  readinessDeltaScore: number | null;
  applicationsSubmitted: number;
  applicationsMoving: number;
  completedWithVitalCv: string[];
  recentChanges: ProofChange[];
}

export interface EmployerProofApplication {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  provider: {
    fullName: string | null;
    npi: string | null;
  } | null;
  opportunity: {
    title: string;
    state: string;
  };
  readiness: {
    readinessScore: number;
    readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
    gapSummary: string[];
    keyCredentials: string[];
    trustSignals: string[];
  } | null;
}

export interface EmployerProofSummary {
  readinessVisibleCount: number;
  readyCandidatesCount: number;
  issuesIdentifiedBeforeReviewCount: number;
  preparedReviewCount: number;
  reviewActionCount: number;
  applicationsMovingCount: number;
  findingsVisibleCount: number;
  storylinesVisibleCount: number;
  actionQueueCount: number;
  recentChanges: ProofChange[];
}

function parseOccurredAt(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function providerLabel(application: EmployerProofApplication): string {
  return application.provider?.fullName
    ?? (application.provider?.npi ? `NPI ${application.provider.npi}` : 'Clinician');
}

function uniqueChanges(changes: readonly ProofChange[]): ProofChange[] {
  const seen = new Set<string>();
  const items: ProofChange[] = [];

  changes.forEach((change) => {
    if (seen.has(change.id)) {
      return;
    }
    seen.add(change.id);
    items.push(change);
  });

  return items
    .sort((left, right) => parseOccurredAt(right.occurredAt) - parseOccurredAt(left.occurredAt))
    .slice(0, 8);
}

function readinessHistoryExtremes(history: readonly MobileTrustHistoryEntry[]): {
  current: MobileTrustHistoryEntry | null;
  baseline: MobileTrustHistoryEntry | null;
} {
  if (history.length === 0) {
    return { current: null, baseline: null };
  }

  return {
    current: history[0] ?? null,
    baseline: history[history.length - 1] ?? null,
  };
}

function buildReadinessChanges(history: readonly MobileTrustHistoryEntry[]): ProofChange[] {
  return history
    .filter((entry) => entry.deltaScore !== null || entry.newGaps.length > 0 || entry.resolvedGaps.length > 0)
    .map((entry) => {
      const summary = entry.resolvedGaps.length > 0
        ? `Readiness moved to ${entry.readinessLevel} ${entry.readinessScore}/100 after resolving ${entry.resolvedGaps.length} blocker${entry.resolvedGaps.length === 1 ? '' : 's'}.`
        : entry.newGaps.length > 0
          ? `Readiness changed to ${entry.readinessLevel} ${entry.readinessScore}/100 after ${entry.newGaps[0]}.`
          : `Readiness moved to ${entry.readinessLevel} ${entry.readinessScore}/100.`;

      return {
        id: `readiness:${entry.id}`,
        title: `Readiness ${entry.readinessLevel}`,
        summary,
        occurredAt: entry.computedAt ?? new Date().toISOString(),
        href: '/holder/readiness',
      };
    });
}

function outcomeChangeTitle(change: OutcomeStateChange): string {
  switch (change.outcomeType) {
    case 'onboarding_completed':
      return 'Onboarding completed';
    case 'blocker_resolved':
      return 'Blocker resolved';
    case 'readiness_improved':
      return 'Readiness improved';
    case 'trust_state_changed':
      return 'Trust state changed';
    case 'application_submitted':
      return 'Application submitted';
    case 'application_status_moved':
      return 'Application moved';
    case 'employer_reviewed':
      return 'Employer reviewed';
    case 'employer_action_generated':
      return 'Action generated';
    case 'finding_surfaced':
      return 'Finding surfaced';
    case 'storyline_created':
      return 'Storyline created';
    default:
      return 'Recorded change';
  }
}

function mapOutcomeChange(change: OutcomeStateChange): ProofChange {
  return {
    id: change.id,
    title: outcomeChangeTitle(change),
    summary: change.summary,
    occurredAt: change.occurredAt,
    href: change.href ?? '/holder/home',
  };
}

export function buildApplicationProofMoments(
  application: MobileApplication,
  proof?: ClinicianProofPayload | null,
): string[] {
  const moments: string[] = [];
  const applicationSummary = proof?.applicationSummaries
    .find((entry) => entry.applicationId === application.id);

  if (applicationSummary) {
    moments.push(applicationSummary.summary);
  }

  if (application.readiness) {
    moments.push(
      `Submitted with ${application.readiness.readinessLevel} ${application.readiness.readinessScore}/100 readiness.`,
    );
  } else {
    moments.push('Submitted with the latest verified VitalCV profile attached.');
  }

  if (application.status === 'REVIEWED') {
    moments.push('Employer review started after the verified profile reached the queue.');
  } else if (application.status === 'ACCEPTED') {
    moments.push('Application advanced to an accepted decision with the verified profile on file.');
  } else if (application.status === 'DECLINED') {
    moments.push('Application reached a final decision after employer review.');
  }

  if (application.readiness?.gapSummary[0]) {
    moments.push(`Current blocker in view: ${application.readiness.gapSummary[0]}.`);
  } else if (application.latestRecommendation?.label) {
    moments.push(application.latestRecommendation.label);
  }

  return moments.slice(0, 3);
}

function buildApplicationChanges(applications: readonly MobileApplication[]): ProofChange[] {
  return applications.flatMap((application) => {
    const changes: ProofChange[] = [{
      id: `application:submitted:${application.id}:${application.createdAt}`,
      title: 'Application submitted',
      summary: `${application.opportunity.title} was submitted with your VitalCV profile.`,
      occurredAt: application.createdAt,
      href: `/holder/applications/${encodeURIComponent(application.id)}`,
    }];

    if (application.status !== 'PENDING') {
      changes.push({
        id: `application:status:${application.id}:${application.updatedAt}:${application.status}`,
        title: `Application ${application.status.toLowerCase().replace(/_/g, ' ')}`,
        summary: `${application.opportunity.title} moved to ${application.status.toLowerCase().replace(/_/g, ' ')}.`,
        occurredAt: application.updatedAt,
        href: `/holder/applications/${encodeURIComponent(application.id)}`,
      });
    }

    return changes;
  });
}

export function buildClinicianProofSummary(data: ClinicianMobileData): ClinicianProofViewModel {
  if (data.proof) {
    const completedWithVitalCv = data.proof.completedBecauseOfVCV.length > 0
      ? data.proof.completedBecauseOfVCV
      : (data.proof.userSummary ? [data.proof.userSummary] : []);

    return {
      blockersResolvedCount: data.proof.metrics.blockersResolved,
      readinessBaselineScore: data.proof.metrics.readinessFromScore,
      readinessCurrentScore: data.proof.metrics.readinessToScore,
      readinessBaselineLevel: data.proof.metrics.readinessFromLevel,
      readinessCurrentLevel: data.proof.metrics.readinessToLevel,
      readinessDeltaScore: data.proof.metrics.readinessDelta,
      applicationsSubmitted: data.proof.metrics.applicationsSubmitted,
      applicationsMoving: data.proof.metrics.applicationsMoving,
      completedWithVitalCv: completedWithVitalCv.slice(0, 4),
      recentChanges: uniqueChanges(data.proof.recentChanges.map((change) => mapOutcomeChange(change))),
    };
  }

  const { current, baseline } = readinessHistoryExtremes(data.trustHistory);
  const blockersResolvedCount = data.trustHistory.reduce((sum, entry) => sum + entry.resolvedGaps.length, 0);
  const applicationsSubmitted = data.applications.length;
  const applicationsMoving = data.applications.filter((application) => (
    application.status !== 'PENDING' && application.status !== 'WITHDRAWN'
  )).length;
  const readinessDeltaScore = current && baseline && current.id !== baseline.id
    ? current.readinessScore - baseline.readinessScore
    : null;

  const completedWithVitalCv = [
    blockersResolvedCount > 0
      ? `Resolved ${blockersResolvedCount} blocker${blockersResolvedCount === 1 ? '' : 's'} in your recorded readiness history.`
      : null,
    current && baseline && current.id !== baseline.id && readinessDeltaScore !== null
      ? `Readiness changed from ${baseline.readinessLevel} ${baseline.readinessScore}/100 to ${current.readinessLevel} ${current.readinessScore}/100.`
      : null,
    applicationsSubmitted > 0
      ? `${applicationsSubmitted} application${applicationsSubmitted === 1 ? '' : 's'} submitted with VitalCV.`
      : null,
    applicationsMoving > 0
      ? `${applicationsMoving} application${applicationsMoving === 1 ? '' : 's'} moved beyond submission.`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    blockersResolvedCount,
    readinessBaselineScore: baseline?.readinessScore ?? null,
    readinessCurrentScore: current?.readinessScore ?? null,
    readinessBaselineLevel: baseline?.readinessLevel ?? null,
    readinessCurrentLevel: current?.readinessLevel ?? null,
    readinessDeltaScore,
    applicationsSubmitted,
    applicationsMoving,
    completedWithVitalCv: completedWithVitalCv.slice(0, 4),
    recentChanges: uniqueChanges([
      ...buildReadinessChanges(data.trustHistory),
      ...buildApplicationChanges(data.applications),
    ]),
  };
}

export function buildEmployerApplicationProofMoments(application: EmployerProofApplication): string[] {
  const moments: string[] = [];

  if (application.readiness) {
    moments.push(
      `Readiness visible at ${application.readiness.readinessLevel} ${application.readiness.readinessScore}/100.`,
    );
  } else {
    moments.push('Candidate readiness is still being computed.');
  }

  if (application.readiness?.gapSummary[0]) {
    moments.push(`Issue identified before review: ${application.readiness.gapSummary[0]}.`);
  }

  if (
    application.readiness
    && (application.readiness.keyCredentials.length > 0 || application.readiness.trustSignals.length > 0)
  ) {
    moments.push('Credential and trust context was prepared before manual review.');
  }

  if (application.status !== 'PENDING') {
    moments.push(`Application moved to ${application.status.toLowerCase().replace(/_/g, ' ')}.`);
  }

  return moments.slice(0, 3);
}

export function buildEmployerValueSignalsSummary(
  valueSignals: EmployerValueSignals,
): EmployerProofSummary {
  return {
    readinessVisibleCount: valueSignals.metrics.candidatesReadyVisible,
    readyCandidatesCount: valueSignals.metrics.candidatesReadyVisible,
    issuesIdentifiedBeforeReviewCount: valueSignals.metrics.issuesFlaggedBeforeReview,
    preparedReviewCount: valueSignals.metrics.preparedContexts,
    reviewActionCount: valueSignals.metrics.reviewActions,
    applicationsMovingCount: valueSignals.metrics.reviewActions,
    findingsVisibleCount: valueSignals.recentChanges.filter((change) => change.outcomeType === 'finding_surfaced').length,
    storylinesVisibleCount: valueSignals.recentChanges.filter((change) => change.outcomeType === 'storyline_created').length,
    actionQueueCount: valueSignals.metrics.actionQueueGenerated,
    recentChanges: uniqueChanges(valueSignals.recentChanges.map((change) => ({
      id: change.id,
      title: outcomeChangeTitle(change),
      summary: change.summary,
      occurredAt: change.occurredAt,
      href: change.href ?? '/verifier/inbox',
    }))),
  };
}

export function buildEmployerProofSummary(input: {
  applications: readonly EmployerProofApplication[];
  findingCount: number;
  storylineCount: number;
  actionCount: number;
}): EmployerProofSummary {
  const readinessVisibleCount = input.applications.filter((application) => Boolean(application.readiness)).length;
  const readyCandidatesCount = input.applications.filter((application) => (
    application.readiness
    && (application.readiness.readinessLevel === 'L2' || application.readiness.readinessLevel === 'L3')
  )).length;
  const issuesIdentifiedBeforeReviewCount = input.applications.filter((application) => (
    Boolean(application.readiness?.gapSummary[0])
  )).length;
  const preparedReviewCount = input.applications.filter((application) => (
    Boolean(
      application.readiness
      && (application.readiness.keyCredentials.length > 0 || application.readiness.trustSignals.length > 0),
    )
  )).length;
  const reviewActionCount = input.applications.filter((application) => (
    Boolean(application.reviewedAt) || application.status !== 'PENDING'
  )).length;
  const applicationsMovingCount = input.applications.filter((application) => application.status !== 'PENDING').length;

  const recentChanges = uniqueChanges(input.applications.flatMap((application) => {
    const changes: ProofChange[] = [{
      id: `employer:submitted:${application.id}:${application.createdAt}`,
      title: 'Candidate submitted',
      summary: `${providerLabel(application)} entered ${application.opportunity.title} with VitalCV context attached.`,
      occurredAt: application.createdAt,
      href: '/verifier/inbox',
    }];

    if (application.status !== 'PENDING') {
      changes.push({
        id: `employer:status:${application.id}:${application.updatedAt}:${application.status}`,
        title: `Application ${application.status.toLowerCase().replace(/_/g, ' ')}`,
        summary: `${providerLabel(application)} moved to ${application.status.toLowerCase().replace(/_/g, ' ')} for ${application.opportunity.title}.`,
        occurredAt: application.updatedAt,
        href: '/verifier/inbox',
      });
    }

    if (application.readiness?.gapSummary[0]) {
      changes.push({
        id: `employer:issue:${application.id}:${application.updatedAt}`,
        title: 'Issue identified before review',
        summary: `${providerLabel(application)} reached the queue with ${application.readiness.gapSummary[0]}.`,
        occurredAt: application.updatedAt,
        href: '/verifier/inbox',
      });
    }

    return changes;
  }));

  return {
    readinessVisibleCount,
    readyCandidatesCount,
    issuesIdentifiedBeforeReviewCount,
    preparedReviewCount,
    reviewActionCount,
    applicationsMovingCount,
    findingsVisibleCount: input.findingCount,
    storylinesVisibleCount: input.storylineCount,
    actionQueueCount: input.actionCount,
    recentChanges,
  };
}
