import {
  EvidencePoint,
  ExplainSectionOptions,
  PayerEnrollmentStatus,
  PayerProfile,
  SectionNarrative,
} from './narrativeTypes';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  compareBySeverity,
  dedupeStrings,
  emptySection,
  formatDate,
  limitList,
} from './utils';

export function explainPayerSection(
  profile?: PayerProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    return emptySection('payer');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const enrollments = [...(profile.enrollments ?? [])];
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE');
  const pendingEnrollments = enrollments.filter((enrollment) => enrollment.status === 'PENDING');
  const blockedEnrollments = enrollments.filter(
    (enrollment) => enrollment.status === 'TERMINATED' || enrollment.status === 'BLOCKED'
  );

  const summaryParts = [
    `${activeEnrollments.length} active payer enrollment${activeEnrollments.length === 1 ? '' : 's'}`,
    `${pendingEnrollments.length} pending`,
  ];

  if (blockedEnrollments.length > 0) {
    summaryParts.push(`${blockedEnrollments.length} blocked/terminated`);
  } else {
    summaryParts.push('no terminated enrollments');
  }

  if (profile.pecosSummary) {
    summaryParts.push(`PECOS: ${profile.pecosSummary}`);
  }
  if (profile.medicaidSummary) {
    summaryParts.push(`Medicaid: ${profile.medicaidSummary}`);
  }

  const highlights: string[] = [];
  if (activeEnrollments.length > 0) {
    highlights.push(
      `Active with ${uniquePayers(activeEnrollments)} payer${activeEnrollments.length === 1 ? '' : 's'}.`
    );
  }
  if (profile.pecosSummary?.toLowerCase().includes('aligned')) {
    highlights.push('PECOS enrollment aligned.');
  }
  if (pendingEnrollments.length === 0 && blockedEnrollments.length === 0) {
    highlights.push('No enrollment gaps detected.');
  }

  const concerns: string[] = [];

  pendingEnrollments.forEach((enrollment) => {
    concerns.push(
      `${enrollment.payerName} ${enrollment.program} pending since ${formatDate(
        enrollment.effectiveDate
      )}.`
    );
  });

  blockedEnrollments.forEach((enrollment) => {
    concerns.push(
      `${enrollment.payerName} ${enrollment.program} ${enrollment.status.toLowerCase()}${
        enrollment.notes ? ` – ${enrollment.notes}` : ''
      }.`
    );
  });

  (profile.panelIssues ?? []).forEach((issue) => {
    concerns.push(
      `Panel issue (${issue.severity}) for ${issue.payerName ?? 'unknown payer'} – ${
        issue.description
      }${issue.dueAt ? `, due ${formatDate(issue.dueAt)}` : ''}.`
    );
  });

  (profile.gaps ?? []).forEach((gap) => concerns.push(gap));

  const evidence = buildPayerEvidence(profile);

  return {
    section: 'payer',
    summary: summaryParts.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence: enrollments.length > 0 ? 'high' : 'medium',
  };
}

function uniquePayers(enrollments: PayerEnrollmentStatus[]): number {
  const set = new Set(enrollments.map((enrollment) => enrollment.payerId));
  return set.size;
}

function buildPayerEvidence(profile: PayerProfile): EvidencePoint[] {
  const evidence: EvidencePoint[] = [];

  const enrollments = [...(profile.enrollments ?? [])];
  enrollments
    .sort((a, b) => {
      const severityA = severityFromEnrollment(a);
      const severityB = severityFromEnrollment(b);
      return (
        compareBySeverity(severityA, severityB) ||
        a.payerName.localeCompare(b.payerName) ||
        a.program.localeCompare(b.program)
      );
    })
    .forEach((enrollment) => {
      evidence.push({
        id: `${enrollment.payerId}-${enrollment.program}`,
        label: `${enrollment.payerName} – ${enrollment.program}`,
        severity: severityFromEnrollment(enrollment),
        detail: `${enrollment.status}${
          enrollment.effectiveDate ? `, effective ${formatDate(enrollment.effectiveDate)}` : ''
        }${enrollment.panelStatus ? ` • panel ${enrollment.panelStatus.toLowerCase()}` : ''}${
          enrollment.pecosAligned === false ? ' • PECOS gap' : ''
        }`,
        observedAt: enrollment.lastUpdated,
        sectionRef: 'payer',
      });
    });

  const panelIssues =
    profile.panelIssues?.sort(
      (a, b) =>
        compareBySeverity(a.severity, b.severity) ||
        (b.openedAt ?? '').localeCompare(a.openedAt ?? '')
    ) ?? [];

  panelIssues.forEach((issue) => {
    evidence.push({
      id: issue.id,
      label: `Panel issue – ${issue.payerName ?? 'unknown payer'}`,
      severity: issue.severity,
      detail: `${issue.description}${
        issue.dueAt ? `, due ${formatDate(issue.dueAt)}` : ''
      } (${issue.status.toLowerCase()})`,
      observedAt: issue.openedAt,
      sectionRef: 'payer',
    });
  });

  return evidence;
}

function severityFromEnrollment(enrollment: PayerEnrollmentStatus): 'info' | 'low' | 'medium' | 'high' {
  switch (enrollment.status) {
    case 'ACTIVE':
      return enrollment.panelStatus === 'FULL' ? 'medium' : 'low';
    case 'PENDING':
      return 'medium';
    case 'TERMINATED':
    case 'BLOCKED':
      return 'high';
    default:
      return 'info';
  }
}


