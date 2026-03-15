/**
 * freshnessModel.ts — Verification Freshness Model
 *
 * Per-claim-class freshness windows, decay rules, and scoring impact.
 *
 * Freshness is a first-class verification dimension — not just a metadata
 * tag. How fresh your data is determines how much trust you can assert.
 *
 * Design principles:
 * - Each claim class has its own SLA derived from its risk profile
 * - Exclusion/sanctions: daily (highest risk)
 * - Licensure: weekly (changes with board action)
 * - Enrollment: monthly (CMS processes are slow)
 * - Academic: quarterly (publications don't change daily)
 * - Freshness decays on a curve, not a cliff
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Claim class definitions ───────────────────────────────────────────────────

export type ClaimClass =
  | 'NPI_IDENTITY'
  | 'LICENSURE'
  | 'EXCLUSION_SANCTIONS'
  | 'ENROLLMENT'
  | 'BOARD_CERTIFICATION'
  | 'OPEN_PAYMENTS'
  | 'ACADEMIC_PUBLICATION'
  | 'INSTITUTIONAL_AFFILIATION';

export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'NOT_VERIFIED';

/**
 * Freshness window for a claim class.
 *
 * freshWindowHours:   Fully fresh — no score impact
 * agingWindowHours:   Approaching SLA — minor decay
 * staleThresholdHours: Beyond SLA — score penalized, monitoring alert triggered
 * criticalThresholdHours: Very stale — treat as unverified for scoring purposes
 * checkFrequency:     Recommended re-verification cadence
 * riskLevel:          Influences monitoring priority
 */
export interface ClaimFreshnessSpec {
  claimClass:            ClaimClass;
  label:                 string;
  sources:               string[];        // Primary sources for this claim class
  freshWindowHours:      number;          // Below this = FRESH
  agingWindowHours:      number;          // Between fresh and stale = AGING
  staleThresholdHours:   number;          // Above this = STALE
  criticalThresholdHours: number;         // Above this = treat as NOT_VERIFIED
  checkFrequency:        string;          // Human label (e.g. 'Daily', 'Weekly')
  riskLevel:             'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  decayEffect:           string;          // Description of score impact when stale
  monitoringPriority:    number;          // 1 (highest) → 5 (lowest) for scheduling
}

export const FRESHNESS_SPECS: Record<ClaimClass, ClaimFreshnessSpec> = {
  EXCLUSION_SANCTIONS: {
    claimClass:            'EXCLUSION_SANCTIONS',
    label:                 'Exclusion / Sanctions',
    sources:               ['OIG_LEIE', 'SAM_GOV'],
    freshWindowHours:      24,      // 1 day
    agingWindowHours:      48,      // 2 days
    staleThresholdHours:   72,      // 3 days — beyond this is unacceptable for healthcare
    criticalThresholdHours: 168,    // 1 week — effectively unverified
    checkFrequency:        'Daily',
    riskLevel:             'CRITICAL',
    decayEffect:           'Score drops 40-75% — band capped at L1. Cannot assert clean exclusion status.',
    monitoringPriority:    1,
  },

  LICENSURE: {
    claimClass:            'LICENSURE',
    label:                 'State Medical Licensure',
    sources:               ['PECOS_PUBLIC', 'STATE_BOARD', 'NURSYS', 'NURSYS_ENOTIFY'],
    freshWindowHours:      168,     // 1 week
    agingWindowHours:      336,     // 2 weeks
    staleThresholdHours:   720,     // 30 days
    criticalThresholdHours: 2160,   // 90 days
    checkFrequency:        'Weekly',
    riskLevel:             'HIGH',
    decayEffect:           'Score drops 15-35% on licensure dimension. Board actions may not be reflected.',
    monitoringPriority:    2,
  },

  NPI_IDENTITY: {
    claimClass:            'NPI_IDENTITY',
    label:                 'NPI Identity',
    sources:               ['NPPES_API', 'NPPES_BULK'],
    freshWindowHours:      168,     // 1 week
    agingWindowHours:      720,     // 30 days
    staleThresholdHours:   1440,    // 60 days
    criticalThresholdHours: 4320,   // 6 months
    checkFrequency:        'Weekly',
    riskLevel:             'HIGH',
    decayEffect:           'Identity confidence reduces 25%. Name/address/specialty changes may not be reflected.',
    monitoringPriority:    2,
  },

  ENROLLMENT: {
    claimClass:            'ENROLLMENT',
    label:                 'CMS Medicare/Medicaid Enrollment',
    sources:               ['PECOS_PUBLIC', 'DOCTORS_CLINICIANS'],
    freshWindowHours:      720,     // 30 days
    agingWindowHours:      1440,    // 60 days
    staleThresholdHours:   2160,    // 90 days
    criticalThresholdHours: 8760,   // 1 year
    checkFrequency:        'Monthly',
    riskLevel:             'MEDIUM',
    decayEffect:           'Enrollment confidence reduces 30%. CMS changes take weeks to propagate.',
    monitoringPriority:    3,
  },

  BOARD_CERTIFICATION: {
    claimClass:            'BOARD_CERTIFICATION',
    label:                 'Board Certification',
    sources:               ['ABMS', 'AOA'],
    freshWindowHours:      720,     // 30 days
    agingWindowHours:      2160,    // 90 days
    staleThresholdHours:   8760,    // 1 year
    criticalThresholdHours: 26280,  // 3 years
    checkFrequency:        'Annually',
    riskLevel:             'MEDIUM',
    decayEffect:           'Board cert confidence reduces 35%. Maintenance of Certification cycles not reflected.',
    monitoringPriority:    3,
  },

  OPEN_PAYMENTS: {
    claimClass:            'OPEN_PAYMENTS',
    label:                 'Open Payments / Industry Relationships',
    sources:               ['OPEN_PAYMENTS'],
    freshWindowHours:      8760,    // 1 year (annual CMS release)
    agingWindowHours:      13140,   // 18 months
    staleThresholdHours:   17520,   // 2 years
    criticalThresholdHours: 26280,  // 3 years
    checkFrequency:        'Annually',
    riskLevel:             'LOW',
    decayEffect:           'Industry payment data ages with annual CMS release cycle. Minor scoring impact.',
    monitoringPriority:    5,
  },

  ACADEMIC_PUBLICATION: {
    claimClass:            'ACADEMIC_PUBLICATION',
    label:                 'Academic / Research Identity',
    sources:               ['OPENALEX', 'PUBMED', 'CLINICAL_TRIALS', 'ORCID'],
    freshWindowHours:      2160,    // 90 days
    agingWindowHours:      4320,    // 6 months
    staleThresholdHours:   8760,    // 1 year
    criticalThresholdHours: 26280,  // 3 years
    checkFrequency:        'Quarterly',
    riskLevel:             'LOW',
    decayEffect:           'New publications / trial registrations not reflected. Minor scoring impact.',
    monitoringPriority:    5,
  },

  INSTITUTIONAL_AFFILIATION: {
    claimClass:            'INSTITUTIONAL_AFFILIATION',
    label:                 'Institutional Affiliation',
    sources:               ['HOSPITAL_DIRECTORY', 'NPPES_API', 'OPEN_PAYMENTS'],
    freshWindowHours:      2160,    // 90 days
    agingWindowHours:      4320,    // 6 months
    staleThresholdHours:   8760,    // 1 year
    criticalThresholdHours: 17520,  // 2 years
    checkFrequency:        'Quarterly',
    riskLevel:             'MEDIUM',
    decayEffect:           'Employment/affiliation changes may not be reflected. Moderate impact on context.',
    monitoringPriority:    4,
  },
};

// ── Freshness computation ──────────────────────────────────────────────────────

export interface ClaimClassFreshness {
  claimClass:         ClaimClass;
  label:              string;
  lastVerifiedAt:     string | null;      // ISO timestamp
  ageHours:           number;             // Age in hours (0 if never checked)
  status:             FreshnessStatus;
  nextRecommendedAt:  string | null;      // When to re-verify
  freshnessScore:     number;             // 0.0–1.0 freshness factor
  scoreImpact:        'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  decayEffect:        string;
  sources:            string[];           // Which sources provided this data
  monitoringPriority: number;
}

export interface ClaimFreshnessReport {
  npi:              string;
  computedAt:       string;
  overallFreshness: number;               // 0.0–1.0 aggregate freshness score
  dimensions:       ClaimClassFreshness[];
  staleDimensions:  ClaimClassFreshness[];
  agingDimensions:  ClaimClassFreshness[];
  freshDimensions:  ClaimClassFreshness[];
  notVerified:      ClaimClassFreshness[];
  monitoringAlerts: MonitoringAlert[];
}

export interface MonitoringAlert {
  claimClass:  ClaimClass;
  severity:    'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message:     string;
  ageHours:    number;
  action:      string;
}

// Source → claim class mapping
const SOURCE_TO_CLAIM_CLASS: Record<string, ClaimClass> = {
  NPPES_API:              'NPI_IDENTITY',
  NPPES_BULK:             'NPI_IDENTITY',
  IDENTITY_INDEX:         'NPI_IDENTITY',
  PECOS_PUBLIC:           'ENROLLMENT',
  DOCTORS_CLINICIANS:     'ENROLLMENT',
  OIG_LEIE:               'EXCLUSION_SANCTIONS',
  SAM_GOV:                'EXCLUSION_SANCTIONS',
  STATE_BOARD:            'LICENSURE',
  NURSYS:                 'LICENSURE',
  NURSYS_ENOTIFY:         'LICENSURE',
  ABMS:                   'BOARD_CERTIFICATION',
  AOA:                    'BOARD_CERTIFICATION',
  BOARD_CERT:             'BOARD_CERTIFICATION',
  OPEN_PAYMENTS:          'OPEN_PAYMENTS',
  OPENALEX:               'ACADEMIC_PUBLICATION',
  PUBMED:                 'ACADEMIC_PUBLICATION',
  CLINICAL_TRIALS:        'ACADEMIC_PUBLICATION',
  ORCID:                  'ACADEMIC_PUBLICATION',
  HOSPITAL_DIRECTORY:     'INSTITUTIONAL_AFFILIATION',
};

function computeFreshnessStatus(ageHours: number, spec: ClaimFreshnessSpec): FreshnessStatus {
  if (ageHours <= spec.freshWindowHours) return 'FRESH';
  if (ageHours <= spec.staleThresholdHours) return 'AGING';
  return 'STALE';
}

function computeFreshnessScore(ageHours: number, spec: ClaimFreshnessSpec): number {
  if (ageHours <= spec.freshWindowHours) return 1.0;
  if (ageHours >= spec.criticalThresholdHours) return 0.0;

  if (ageHours <= spec.staleThresholdHours) {
    // Linear decay from 1.0 → 0.5 in aging window
    const t = (ageHours - spec.freshWindowHours) / (spec.staleThresholdHours - spec.freshWindowHours);
    return Math.round((1.0 - t * 0.5) * 100) / 100;
  }

  // Decay from 0.5 → 0.0 in stale window
  const t = (ageHours - spec.staleThresholdHours) / (spec.criticalThresholdHours - spec.staleThresholdHours);
  return Math.round(Math.max(0, 0.5 - t * 0.5) * 100) / 100;
}

function computeScoreImpact(status: FreshnessStatus, riskLevel: string): 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' {
  if (status === 'FRESH' || status === 'NOT_VERIFIED') return 'NONE';
  if (status === 'AGING' && riskLevel === 'LOW') return 'MINOR';
  if (status === 'AGING' && riskLevel === 'MEDIUM') return 'MINOR';
  if (status === 'AGING' && riskLevel === 'HIGH') return 'MODERATE';
  if (status === 'AGING' && riskLevel === 'CRITICAL') return 'MODERATE';
  if (status === 'STALE' && riskLevel === 'LOW') return 'MINOR';
  if (status === 'STALE' && riskLevel === 'MEDIUM') return 'MODERATE';
  if (status === 'STALE' && riskLevel === 'HIGH') return 'SEVERE';
  if (status === 'STALE' && riskLevel === 'CRITICAL') return 'SEVERE';
  return 'NONE';
}

export async function computeTrustFreshness(npi: string): Promise<ClaimFreshnessReport> {
  // Load newest artifact per source
  const arts = await prisma.verificationArtifact.findMany({
    where: { npi, status: { not: 'REVOKED' } },
    orderBy: { verifiedAt: 'desc' },
    select: { source: true, verifiedAt: true },
  });

  // Map source → newest verifiedAt
  const sourceAge = new Map<string, Date>();
  for (const art of arts) {
    if (!sourceAge.has(art.source)) {
      sourceAge.set(art.source, art.verifiedAt);
    }
  }

  // Aggregate to claim class → newest across sources
  const classAge = new Map<ClaimClass, { age: Date; sources: string[] }>();
  for (const [source, verifiedAt] of sourceAge) {
    const cls = SOURCE_TO_CLAIM_CLASS[source];
    if (!cls) continue;
    const existing = classAge.get(cls);
    if (!existing || verifiedAt > existing.age) {
      classAge.set(cls, { age: verifiedAt, sources: [source] });
    } else if (verifiedAt.getTime() === existing.age.getTime()) {
      existing.sources.push(source);
    }
  }

  const now = Date.now();
  const dimensions: ClaimClassFreshness[] = [];
  const monitoringAlerts: MonitoringAlert[] = [];

  for (const [claimClass, spec] of Object.entries(FRESHNESS_SPECS) as [ClaimClass, ClaimFreshnessSpec][]) {
    const entry = classAge.get(claimClass);

    if (!entry) {
      dimensions.push({
        claimClass, label: spec.label,
        lastVerifiedAt: null,
        ageHours: 0,
        status: 'NOT_VERIFIED',
        nextRecommendedAt: new Date().toISOString(),
        freshnessScore: 0,
        scoreImpact: 'NONE',
        decayEffect: spec.decayEffect,
        sources: [],
        monitoringPriority: spec.monitoringPriority,
      });
      continue;
    }

    const ageHours = (now - entry.age.getTime()) / 3_600_000;
    const status = computeFreshnessStatus(ageHours, spec);
    const freshnessScore = computeFreshnessScore(ageHours, spec);
    const scoreImpact = computeScoreImpact(status, spec.riskLevel);

    // Next recommended check
    const nextMs = entry.age.getTime() + spec.freshWindowHours * 3_600_000;
    const nextRecommendedAt = new Date(Math.max(nextMs, now)).toISOString();

    dimensions.push({
      claimClass, label: spec.label,
      lastVerifiedAt:     entry.age.toISOString(),
      ageHours:           Math.round(ageHours),
      status, nextRecommendedAt, freshnessScore, scoreImpact,
      decayEffect:        spec.decayEffect,
      sources:            entry.sources,
      monitoringPriority: spec.monitoringPriority,
    });

    // Generate monitoring alerts
    if (status === 'STALE') {
      monitoringAlerts.push({
        claimClass,
        severity: spec.riskLevel === 'CRITICAL' ? 'CRITICAL'
                : spec.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        message:  `${spec.label} verification stale — ${Math.round(ageHours / 24)}d old (SLA: ${spec.staleThresholdHours / 24}d)`,
        ageHours: Math.round(ageHours),
        action:   `Re-ingest ${spec.sources.join(' or ')} via POST /api/identity/${npi}/ingest`,
      });
    }
  }

  // Sort by priority
  dimensions.sort((a, b) => a.monitoringPriority - b.monitoringPriority);

  const staleDimensions   = dimensions.filter(d => d.status === 'STALE');
  const agingDimensions   = dimensions.filter(d => d.status === 'AGING');
  const freshDimensions   = dimensions.filter(d => d.status === 'FRESH');
  const notVerified       = dimensions.filter(d => d.status === 'NOT_VERIFIED');

  // Overall freshness = weighted average
  const overallFreshness = dimensions
    .filter(d => d.status !== 'NOT_VERIFIED')
    .reduce((sum, d) => sum + d.freshnessScore, 0) /
    Math.max(1, dimensions.filter(d => d.status !== 'NOT_VERIFIED').length);

  log('debug', `[FreshnessModel] NPI ${npi} overall freshness: ${Math.round(overallFreshness * 100)}%`);

  return {
    npi,
    computedAt: new Date().toISOString(),
    overallFreshness: Math.round(overallFreshness * 100) / 100,
    dimensions,
    staleDimensions,
    agingDimensions,
    freshDimensions,
    notVerified,
    monitoringAlerts,
  };
}
