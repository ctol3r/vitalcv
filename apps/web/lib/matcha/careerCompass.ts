// apps/web/lib/matcha/careerCompass.ts
//
// Career Compass (Wave 4, Part 1) — the signed-in centerpiece: "where you are,
// and the one thing to do next." Pure + isomorphic so the truth logic is
// unit-tested and the surface stays a thin renderer.
//
// Truth rule (mirrors the MATCHA engine + scoreboard modules): every number and
// every recommendation is derived ONLY from the clinician's real account
// signals — source-backed readiness, recorded employer acceptances, live engine
// matches, profile completeness, and their open readiness items. The "one next
// action" is chosen deterministically by priority; its impact is stated as
// honest real COUNTS ("clears 1 of your 3 open items"), never fabricated deltas
// like "+6 Recognition". Confidence reflects DATA COVERAGE, not a made-up
// percentage: it is "High" only when a source-backed readiness snapshot exists.
// If MATCHA cannot ground it, MATCHA does not claim it.

export type CompassTone = 'strong' | 'progress' | 'attention' | 'empty' | 'unavailable';
export type CompassConfidence = 'High' | 'Building';

export interface CompassMetric {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone: CompassTone;
}

export interface CompassAction {
  /** e.g. "Resolve: License renewal". */
  title: string;
  /** Why this is the next step — tied to a real item. */
  why: string;
  href: string;
  ctaLabel: string;
  /** Honest, real-count impact statements (never fabricated deltas). */
  impact: string[];
  confidence: CompassConfidence;
  confidenceReason: string;
}

export interface CareerCompassModel {
  metrics: CompassMetric[];
  action: CompassAction;
  /** Honest footnote about what is and isn't measured. */
  note: string;
}

export interface CompassBlocker {
  title: string;
  detail: string;
  href: string;
  nextActionLabel: string;
}

export interface CompassInput {
  readiness: { score: number; level: string } | null;
  recognition: { state: 'recognized' | 'none_recorded' | 'unavailable'; count?: number };
  opportunities: { total: number; clearedToApply: number };
  profileScore: number | null;
  blockers: CompassBlocker[];
  recommendedAction: { title: string; description: string; href: string; ctaLabel: string } | null;
}

function readinessMetric(readiness: CompassInput['readiness']): CompassMetric {
  if (!readiness) {
    return {
      key: 'readiness',
      label: 'Readiness',
      value: '—',
      sub: 'Add your NPI to measure it',
      tone: 'empty',
    };
  }
  const tone: CompassTone = readiness.score >= 75 ? 'strong' : readiness.score >= 50 ? 'progress' : 'attention';
  return {
    key: 'readiness',
    label: 'Readiness',
    value: `${readiness.score}%`,
    sub: readiness.level,
    tone,
  };
}

function recognitionMetric(recognition: CompassInput['recognition']): CompassMetric {
  if (recognition.state === 'recognized') {
    const count = recognition.count ?? 0;
    return {
      key: 'recognition',
      label: 'Recognition',
      value: count > 0 ? `${count}` : 'Recorded',
      sub: count === 1 ? 'employer acceptance' : 'employer acceptances',
      tone: 'strong',
    };
  }
  if (recognition.state === 'unavailable') {
    return { key: 'recognition', label: 'Recognition', value: '—', sub: 'temporarily unavailable', tone: 'unavailable' };
  }
  return { key: 'recognition', label: 'Recognition', value: 'None yet', sub: 'earned when an employer accepts', tone: 'empty' };
}

function rolesMetric(opportunities: CompassInput['opportunities']): CompassMetric {
  if (opportunities.total <= 0) {
    return { key: 'roles', label: 'Roles ready', value: '0', sub: 'no live matches yet', tone: 'empty' };
  }
  return {
    key: 'roles',
    label: 'Roles ready',
    value: `${opportunities.clearedToApply}`,
    sub: `of ${opportunities.total} matched`,
    tone: opportunities.clearedToApply > 0 ? 'strong' : 'progress',
  };
}

function profileMetric(profileScore: number | null): CompassMetric {
  if (profileScore === null) {
    return { key: 'profile', label: 'Profile', value: '—', sub: 'not started', tone: 'empty' };
  }
  const tone: CompassTone = profileScore >= 80 ? 'strong' : profileScore >= 40 ? 'progress' : 'attention';
  return { key: 'profile', label: 'Profile', value: `${profileScore}%`, sub: 'complete', tone };
}

function confidenceFrom(readiness: CompassInput['readiness']): { confidence: CompassConfidence; confidenceReason: string } {
  if (readiness) {
    return { confidence: 'High', confidenceReason: 'Based on your source-backed readiness snapshot.' };
  }
  return { confidence: 'Building', confidenceReason: 'Add your NPI so MATCHA can measure your readiness first.' };
}

/**
 * Choose the single next-best action deterministically by priority:
 *   1. An open readiness item (blocker) — the most concrete, highest-leverage move.
 *   2. The workspace's recommended action, if one is set.
 *   3. Finish the profile, if incomplete.
 *   4. Apply to roles already cleared.
 *   5. Otherwise, keep readiness current.
 */
function chooseAction(input: CompassInput): CompassAction {
  const { confidence, confidenceReason } = confidenceFrom(input.readiness);
  const gated = Math.max(0, input.opportunities.total - input.opportunities.clearedToApply);
  const blockerCount = input.blockers.length;

  if (blockerCount > 0) {
    const b = input.blockers[0];
    const impact: string[] = [
      `Clears 1 of your ${blockerCount} open readiness item${blockerCount === 1 ? '' : 's'}`,
    ];
    if (gated > 0) {
      impact.push(`${gated} of your ${input.opportunities.total} matched roles still have gating items`);
    }
    impact.push('Keeps your evidence employer-ready');
    return {
      title: `Resolve: ${b.title}`,
      why: b.detail,
      href: b.href,
      ctaLabel: b.nextActionLabel || 'Resolve',
      impact,
      confidence,
      confidenceReason,
    };
  }

  if (input.recommendedAction) {
    const r = input.recommendedAction;
    return {
      title: r.title,
      why: r.description,
      href: r.href,
      ctaLabel: r.ctaLabel || 'Continue',
      impact: ['Your next recorded step toward a stronger match'],
      confidence,
      confidenceReason,
    };
  }

  if (input.profileScore !== null && input.profileScore < 100) {
    return {
      title: 'Complete your profile',
      why: 'A fuller profile strengthens every match and gives reviewers more to work from.',
      href: '/clinician/profile',
      ctaLabel: 'Edit profile',
      impact: [`Profile is ${input.profileScore}% complete`, 'Stronger profile → stronger matches'],
      confidence,
      confidenceReason,
    };
  }

  if (input.opportunities.clearedToApply > 0) {
    return {
      title: `Apply to ${input.opportunities.clearedToApply} role${input.opportunities.clearedToApply === 1 ? '' : 's'} you're ready for`,
      why: 'These live roles have no gating items outstanding against your evidence.',
      href: '/holder/opportunities',
      ctaLabel: 'View roles',
      impact: [`${input.opportunities.clearedToApply} cleared to apply now`],
      confidence,
      confidenceReason,
    };
  }

  return {
    title: 'Keep your readiness current',
    why: 'Nothing is blocking your next step right now — keep your evidence fresh so matches stay strong.',
    href: '/holder/readiness',
    ctaLabel: 'Open readiness',
    impact: ['Nothing is blocking you right now'],
    confidence,
    confidenceReason,
  };
}

/**
 * Build the Career Compass from the clinician's real account signals.
 */
export function buildCareerCompass(input: CompassInput): CareerCompassModel {
  return {
    metrics: [
      readinessMetric(input.readiness),
      recognitionMetric(input.recognition),
      rolesMetric(input.opportunities),
      profileMetric(input.profileScore),
    ],
    action: chooseAction(input),
    note: 'Every number here is your own — VitalCV shows what it can measure from your evidence and no more. It does not estimate interview odds, salaries, or outcomes.',
  };
}
