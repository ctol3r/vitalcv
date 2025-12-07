import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import type { LifecycleWatchFinding } from './watcher';
import { LifecycleWatcher } from './watcher';

const prisma = new PrismaDelegate();

export type RenewalSuggestionType = 'cmeCourse' | 'boardRecertReminder' | 'compactDeployment';

export interface RenewalSuggestion {
  type: RenewalSuggestionType;
  title: string;
  impactScore: number;
  rationale: string;
  actions: string[];
  links?: Array<{ label: string; url: string }>;
  metadata?: Record<string, unknown>;
}

export interface RenewalSuggestionContext {
  clinicianId: string;
  specialty?: string | null;
  findings?: LifecycleWatchFinding[];
  compactEligibleStates?: string[];
  compactActiveStates?: string[];
  cmeCatalog?: CmeCourse[];
}

export interface RenewalSuggestionOptions {
  now?: Date;
  cmeCatalog?: CmeCourse[];
}

interface ProfileSnapshot {
  primarySpecialty?: string | null;
  specialties?: string[] | null;
}

interface PassportSnapshot {
  statesEligible?: string[];
  compactStatus?: Record<string, unknown> | null;
}

export interface CmeCourse {
  id: string;
  title: string;
  category: string;
  specialties: string[];
  hours: number;
  url: string;
  provider: string;
}

export const DEFAULT_CME_CATALOG: CmeCourse[] = [
  {
    id: 'opioid-stewardship',
    title: 'Opioid Stewardship + Safe Prescribing 2025',
    category: 'primary',
    specialties: ['family medicine', 'internal medicine', 'emergency'],
    hours: 8,
    url: 'https://learn.vitalcv.health/cme/opioid-stewardship-2025',
    provider: 'VitalCV Learning Lab',
  },
  {
    id: 'telehealth-compact',
    title: 'Telehealth Compact Deployment Playbook',
    category: 'compact',
    specialties: ['telehealth', 'urgent care', 'pediatrics'],
    hours: 5,
    url: 'https://learn.vitalcv.health/cme/telehealth-compact',
    provider: 'CompactReady Institute',
  },
  {
    id: 'cardio-refresh',
    title: 'Structural Heart CME Intensive',
    category: 'cardiology',
    specialties: ['cardiology', 'interventional'],
    hours: 12,
    url: 'https://learn.vitalcv.health/cme/structural-heart-intensive',
    provider: 'American Cardio Collaborative',
  },
  {
    id: 'cme-general',
    title: 'National CME Core: Documentation, Equity, Stewardship',
    category: 'general',
    specialties: ['family medicine', 'internal medicine', 'hospitalist'],
    hours: 10,
    url: 'https://learn.vitalcv.health/cme/national-core',
    provider: 'National CME Consortium',
  },
];

const BOARD_PORTALS: Record<string, { label: string; url: string }> = {
  abim: { label: 'ABIM Physician Portal', url: 'https://www.abim.org/maintenance-of-certification/' },
  abfm: { label: 'ABFM MyMOC', url: 'https://www.theabfm.org/mymoc' },
  abs: { label: 'ABS CertLink', url: 'https://www.absurgery.org/default.jsp?moc' },
  emergency: {
    label: 'ABEM LLSA',
    url: 'https://www.abem.org/maintenance-of-certification/lifelong-learning-self-assessment',
  },
};

export class RenewalSuggestionEngine {
  private readonly watcher: LifecycleWatcher;

  constructor(private readonly db: PrismaClient = prisma, watcher?: LifecycleWatcher) {
    this.watcher = watcher ?? new LifecycleWatcher(db);
  }

  async buildForClinician(
    clinicianId: string,
    options: RenewalSuggestionOptions = {},
  ): Promise<RenewalSuggestion[]> {
    const now = options.now ?? new Date();
    const [findings, profile, passport] = await Promise.all([
      this.watcher.run({ clinicianId, now }),
      this.loadProfile(clinicianId),
      this.loadPassport(clinicianId),
    ]);

    return this.buildSuggestions({
      clinicianId,
      specialty: profile?.primarySpecialty ?? profile?.specialties?.[0],
      findings,
      compactEligibleStates: passport?.statesEligible ?? [],
      compactActiveStates: extractActiveStates(passport?.compactStatus),
      cmeCatalog: options.cmeCatalog ?? DEFAULT_CME_CATALOG,
    });
  }

  buildSuggestions(context: RenewalSuggestionContext): RenewalSuggestion[] {
    const suggestions: RenewalSuggestion[] = [];
    suggestions.push(...buildCmeSuggestion(context));
    suggestions.push(...buildBoardSuggestion(context));
    suggestions.push(...buildCompactSuggestion(context));
    return suggestions.sort((a, b) => b.impactScore - a.impactScore);
  }

  private async loadProfile(clinicianId: string): Promise<ProfileSnapshot | null> {
    try {
      return this.db.clinicianProfile.findUnique({
        where: { id: clinicianId },
        select: { primarySpecialty: true, specialties: true },
      });
    } catch {
      return null;
    }
  }

  private async loadPassport(clinicianId: string): Promise<PassportSnapshot | null> {
    try {
      return this.db.mobilityPassport.findUnique({
        where: { clinicianId },
        select: { statesEligible: true, compactStatus: true },
      });
    } catch {
      return null;
    }
  }
}

function buildCmeSuggestion(context: RenewalSuggestionContext): RenewalSuggestion[] {
  const findings = context.findings ?? [];
  const cmeFinding =
    findings.find((finding) => finding.type === 'cme_overdue') ??
    findings.find((finding) => finding.type === 'cme_due');
  if (!cmeFinding) {
    return [];
  }

  const severity = cmeFinding.type === 'cme_overdue' ? 'critical' : 'warning';
  const catalog = context.cmeCatalog ?? DEFAULT_CME_CATALOG;
  const recommendedCourses = pickCmeCourses(catalog, {
    specialty: context.specialty ?? undefined,
    category: (cmeFinding.metadata?.category as string | undefined) ?? undefined,
  });

  const actions: string[] = recommendedCourses.length
    ? recommendedCourses.map((course) => `Enroll in ${course.title} (${course.hours} CME hrs)`)
    : ['Enroll in CME bundle covering remaining hours', 'Upload completion proof to VitalCV wallet'];
  actions.push('Trigger auto-share of CME transcript to credential lifecycle tracker.');

  return [
    {
      type: 'cmeCourse',
      title: severity === 'critical' ? 'Urgent CME hours required' : 'CME refresh recommended',
      impactScore: severity === 'critical' ? 0.82 : 0.64,
      rationale: buildCmeRationale(cmeFinding),
      actions,
      links: recommendedCourses.length
        ? recommendedCourses.map((course) => ({ label: course.title, url: course.url }))
        : undefined,
      metadata: { finding: cmeFinding },
    },
  ];
}

function buildBoardSuggestion(context: RenewalSuggestionContext): RenewalSuggestion[] {
  const findings = context.findings ?? [];
  const boardFinding =
    findings.find((finding) => finding.type === 'board_recert_overdue') ??
    findings.find((finding) => finding.type === 'board_recert_window');

  if (!boardFinding) {
    return [];
  }

  const severity = boardFinding.type === 'board_recert_overdue' ? 'critical' : 'warning';
  const boardName = (boardFinding.metadata?.board as string | undefined) ?? context.specialty ?? '';
  const portal = resolveBoardPortal(boardName);

  const actions = [
    `Submit recert packet via ${portal.label}.`,
    'Sync updated board letter to lifecycle audit trail.',
  ];
  if (severity === 'critical') {
    actions.unshift('Escalate to credentialing queue for manual recert tracking.');
  }

  return [
    {
      type: 'boardRecertReminder',
      title: severity === 'critical' ? 'Board recertification overdue' : 'Board recert window open',
      impactScore: severity === 'critical' ? 0.78 : 0.6,
      rationale: buildBoardRationale(boardFinding),
      actions,
      links: [{ label: portal.label, url: portal.url }],
      metadata: { finding: boardFinding },
    },
  ];
}

function buildCompactSuggestion(context: RenewalSuggestionContext): RenewalSuggestion[] {
  const findings = context.findings ?? [];
  const licenseFinding =
    findings.find((finding) => finding.type === 'license_expiring') ??
    findings.find((finding) => finding.type === 'license_expired');

  const eligibleStates = context.compactEligibleStates ?? [];
  if (!eligibleStates.length) {
    return [];
  }

  const activeStates = context.compactActiveStates ?? [];
  const underUtilized = eligibleStates.filter((state) => !activeStates.includes(state));
  if (!underUtilized.length && !licenseFinding) {
    return [];
  }

  const highlight = underUtilized.slice(0, 3);
  const impactScore = licenseFinding?.type === 'license_expired' ? 0.7 : 0.55;
  const rationale =
    licenseFinding?.type === 'license_expired'
      ? `Primary license lapse detected. Pre-stage compact redeployment across ${eligibleStates.length} eligible states.`
      : licenseFinding?.type === 'license_expiring'
        ? `License renewal window open; move coverage to compact states (${highlight.join(', ')}) before lapse.`
        : `Compact passport unlocked for ${eligibleStates.length} states, yet only ${activeStates.length} active.`;

  const actions = [
    `Pre-stage renewal packets for ${highlight.join(', ') || eligibleStates.slice(0, 3).join(', ')}.`,
    'Auto-share readiness signal with compact deployment grid.',
  ];
  if (!licenseFinding) {
    actions.push('Notify recruiter marketplace about immediate compact availability.');
  }

  return [
    {
      type: 'compactDeployment',
      title: 'Leverage compact coverage for renewals',
      impactScore,
      rationale,
      actions,
      metadata: {
        finding: licenseFinding,
        eligibleStates,
        activeStates,
      },
    },
  ];
}

function buildCmeRationale(finding: LifecycleWatchFinding): string {
  const hoursRemaining = finding.metadata?.hoursRemaining;
  const daysField = finding.type === 'cme_overdue' ? 'daysOverdue' : 'daysRemaining';
  const daysValue = finding.metadata?.[daysField];
  const category = finding.metadata?.category as string | undefined;

  const parts: string[] = [];
  if (typeof hoursRemaining === 'number') {
    parts.push(`${hoursRemaining} CME hours outstanding`);
  }
  if (typeof daysValue === 'number') {
    parts.push(
      finding.type === 'cme_overdue'
        ? `${Math.abs(daysValue)} days past due`
        : `${daysValue} days remaining`,
    );
  }
  if (category) {
    parts.push(`${category.toUpperCase()} track`);
  }
  return parts.join(' · ') || 'CME maintenance required for renewal.';
}

function buildBoardRationale(finding: LifecycleWatchFinding): string {
  const board = (finding.metadata?.board as string | undefined) ?? 'Board';
  const daysField =
    finding.type === 'board_recert_overdue' ? 'daysOverdue' : 'daysRemaining';
  const days = finding.metadata?.[daysField];
  if (typeof days === 'number') {
    return finding.type === 'board_recert_overdue'
      ? `${board} recert past due by ${Math.abs(days)} days`
      : `${board} recert window closes in ${days} days`;
  }
  return `${board} recertification requires attention.`;
}

function pickCmeCourses(
  catalog: CmeCourse[],
  filters: { specialty?: string; category?: string },
): CmeCourse[] {
  if (!catalog.length) {
    return [];
  }

  const specialty = filters.specialty?.toLowerCase();
  const category = filters.category?.toLowerCase();

  const scored = catalog.map((course) => {
    let score = 0;
    if (specialty && course.specialties.some((spec) => spec.toLowerCase() === specialty)) {
      score += 0.5;
    }
    if (category && course.category.toLowerCase() === category) {
      score += 0.35;
    }
    return { course, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.course);
}

function resolveBoardPortal(boardName?: string): { label: string; url: string } {
  if (!boardName) {
    return {
      label: 'Board Portal',
      url: 'https://www.fsmb.org/board-exams/maintain-your-license/',
    };
  }
  const normalized = boardName.toLowerCase();
  return (
    BOARD_PORTALS[normalized] ?? {
      label: `${boardName} Portal`,
      url: 'https://www.fsmb.org/board-exams/maintain-your-license/',
    }
  );
}

function extractActiveStates(status: Record<string, unknown> | null | undefined): string[] {
  if (!status) {
    return [];
  }
  const active = status['activeStates'];
  if (Array.isArray(active)) {
    return active.filter((entry): entry is string => typeof entry === 'string');
  }
  const deployed = status['deployedStates'];
  if (Array.isArray(deployed)) {
    return deployed.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}


