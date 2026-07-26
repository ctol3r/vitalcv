// apps/web/lib/matcha/scoreboard.ts
//
// Career Scoreboard (Wave 6) — one honest "career at a glance" for the signed-in
// clinician. Pure + isomorphic so the truth logic is unit-tested and the surface
// stays a thin renderer.
//
// Truth rule (mirrors the MATCHA engine + preferences modules): every tile is
// derived ONLY from signals the clinician's own account already holds —
// source-backed readiness, recorded employer acceptances, live engine matches,
// tracked applications, profile completeness, and the clinician's stated MATCHA
// answers. Nothing is estimated or invented. Metrics VitalCV cannot ground from
// real data — interview odds, time-to-promotion, projected "income unlocked",
// network strength — are deliberately OMITTED rather than faked (see
// OMITTED_METRICS). If an input is absent, the tile shows an honest empty state
// instead of a fabricated number.

export type ScoreboardTone = 'strong' | 'progress' | 'attention' | 'empty' | 'unavailable';

export interface ScoreboardTile {
  key: string;
  label: string;
  /** Short display value, e.g. "78/100", "3 recorded", "—". */
  value: string;
  tone: ScoreboardTone;
  /** One honest sentence describing the value or its absence. */
  detail: string;
  /** Provenance — the real signal this tile reads from. */
  source: string;
  href: string;
  ctaLabel: string;
}

export interface RecognitionSummaryInput {
  state: 'recognized' | 'none_recorded' | 'unavailable';
  /** Present only when state === 'recognized'. */
  count?: number;
}

export interface ScoreboardInput {
  /** Source-backed readiness, or null when no NPI/snapshot exists yet. */
  readiness: { score: number; level: string; status: string } | null;
  recognition: RecognitionSummaryInput;
  /** Live engine matches: total surfaced, and how many are cleared to apply. */
  opportunities: { total: number; clearedToApply: number };
  applicationsInMotion: number;
  /** Profile completeness, or null when unavailable. */
  profile: { score: number; answered: number; total: number } | null;
  /**
   * MATCHA preference tuning. `null` omits the tile entirely — used when the
   * MATCHA pilot surface is not enabled, so the scoreboard never links to a
   * route the clinician cannot reach.
   */
  matchaTuning: { percent: number } | null;
  /** Count of open readiness/credential blockers ("what's left"). */
  blockers: number;
}

export interface CareerScoreboard {
  headline: string;
  subhead: string;
  tiles: ScoreboardTile[];
  /** Honest footnote naming what is deliberately not shown. */
  note: string;
}

/** Metrics we will not show because we cannot ground them in real data. */
export const OMITTED_METRICS = [
  'interview readiness / interview odds',
  'time to next promotion',
  'projected income unlocked',
  'network strength',
] as const;

function readinessTone(score: number): ScoreboardTone {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'progress';
  return 'attention';
}

function readinessTile(readiness: ScoreboardInput['readiness']): ScoreboardTile {
  if (!readiness) {
    return {
      key: 'readiness',
      label: 'Readiness',
      value: '—',
      tone: 'empty',
      detail: 'Add your NPI to build a source-backed readiness snapshot.',
      source: 'Source-backed readiness',
      href: '/holder/readiness',
      ctaLabel: 'Start readiness',
    };
  }
  return {
    key: 'readiness',
    label: 'Readiness',
    value: `${readiness.score}/100`,
    tone: readinessTone(readiness.score),
    detail: `${readiness.level} · ${readiness.status}`,
    source: 'Source-backed readiness',
    href: '/holder/readiness',
    ctaLabel: 'Open readiness',
  };
}

function recognitionTile(recognition: RecognitionSummaryInput): ScoreboardTile {
  const base = {
    key: 'recognition',
    label: 'Recognition',
    source: 'Employer acceptances',
    href: '/holder/recognition',
  };
  if (recognition.state === 'recognized') {
    const count = recognition.count ?? 0;
    return {
      ...base,
      value: count > 0 ? `${count} recorded` : 'Recorded',
      tone: 'strong',
      detail: 'An employer accepted your evidence as a head start — it stays on your record.',
      ctaLabel: 'View recognition',
    };
  }
  if (recognition.state === 'unavailable') {
    return {
      ...base,
      value: '—',
      tone: 'unavailable',
      detail: 'Temporarily unavailable — a system state, not a finding about your record.',
      ctaLabel: 'View recognition',
    };
  }
  return {
    ...base,
    value: 'None yet',
    tone: 'empty',
    detail: 'Recorded when an employer accepts your evidence as a head start — not a final credentialing decision.',
    ctaLabel: 'View recognition',
  };
}

function opportunitiesTile(opportunities: ScoreboardInput['opportunities']): ScoreboardTile {
  const base = {
    key: 'opportunities',
    label: 'Roles ready',
    source: 'Live MATCHA matches',
    href: '/holder/opportunities',
    ctaLabel: 'See roles',
  };
  if (opportunities.total <= 0) {
    return {
      ...base,
      value: 'None live',
      tone: 'empty',
      detail: 'No live roles match right now — MATCHA keeps watching in the background.',
    };
  }
  return {
    ...base,
    value: `${opportunities.clearedToApply} ready`,
    tone: opportunities.clearedToApply > 0 ? 'strong' : 'progress',
    detail: `${opportunities.clearedToApply} cleared to apply · ${opportunities.total} matched to your evidence.`,
  };
}

function applicationsTile(count: number): ScoreboardTile {
  const base = {
    key: 'applications',
    label: 'Applications in motion',
    source: 'Your applications',
    href: '/holder/applications',
    ctaLabel: 'Track updates',
  };
  if (count <= 0) {
    return {
      ...base,
      value: 'None active',
      tone: 'empty',
      detail: 'Applications you start with your VitalCV appear here with live status.',
    };
  }
  return {
    ...base,
    value: `${count}`,
    tone: 'progress',
    detail: count === 1 ? 'One application in review with an employer.' : `${count} applications in review with employers.`,
  };
}

function profileTile(profile: ScoreboardInput['profile']): ScoreboardTile {
  const base = {
    key: 'profile',
    label: 'Profile completeness',
    source: 'Your profile record',
    href: '/clinician/profile',
    ctaLabel: 'Edit profile',
  };
  if (!profile) {
    return {
      ...base,
      value: '—',
      tone: 'empty',
      detail: 'Complete your profile to strengthen every match.',
    };
  }
  const tone: ScoreboardTone = profile.score >= 80 ? 'strong' : profile.score >= 40 ? 'progress' : 'attention';
  return {
    ...base,
    value: `${profile.score}%`,
    tone,
    detail: `${profile.answered} of ${profile.total} sections complete.`,
  };
}

function matchaTuningTile(tuning: { percent: number }): ScoreboardTile {
  const tone: ScoreboardTone = tuning.percent >= 60 ? 'strong' : tuning.percent >= 20 ? 'progress' : 'empty';
  return {
    key: 'matcha-tuning',
    label: 'MATCHA tuning',
    value: `${tuning.percent}%`,
    tone,
    detail: 'How well MATCHA understands what you want — from your own answers.',
    source: 'Your MATCHA answers',
    href: '/holder/matcha/assessment',
    ctaLabel: tuning.percent > 0 ? 'Tune further' : 'Start tuning',
  };
}

function blockersTile(blockers: number): ScoreboardTile {
  const base = {
    key: 'whats-left',
    label: "What's left",
    source: 'Readiness gaps',
    href: '/holder/home',
  };
  if (blockers <= 0) {
    return {
      ...base,
      value: 'Clear',
      tone: 'strong',
      detail: 'Nothing is blocking your next step right now.',
      ctaLabel: 'Open dashboard',
    };
  }
  return {
    ...base,
    value: `${blockers} to resolve`,
    tone: 'attention',
    detail: 'Resolve these to raise readiness and unlock more matches.',
    ctaLabel: 'Resolve now',
  };
}

/**
 * Build the honest career scoreboard from the clinician's real account signals.
 * Tile order leads with identity (readiness, recognition), then momentum
 * (roles, applications), then the levers the clinician controls (profile,
 * MATCHA tuning), and closes on the next action ("what's left").
 */
export function buildCareerScoreboard(input: ScoreboardInput): CareerScoreboard {
  const tiles: ScoreboardTile[] = [
    readinessTile(input.readiness),
    recognitionTile(input.recognition),
    opportunitiesTile(input.opportunities),
    applicationsTile(input.applicationsInMotion),
    profileTile(input.profile),
  ];

  if (input.matchaTuning) {
    tiles.push(matchaTuningTile(input.matchaTuning));
  }

  tiles.push(blockersTile(input.blockers));

  return {
    headline: 'Your career at a glance',
    subhead: 'One honest board — readiness, recognition, roles, and the next clear step.',
    tiles,
    note: 'Every tile traces to your own evidence and answers. VitalCV does not estimate interview odds, promotions, or income — those are omitted rather than invented.',
  };
}
