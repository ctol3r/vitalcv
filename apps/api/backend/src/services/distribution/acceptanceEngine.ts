/**
 * acceptanceEngine.ts — Acceptance probability and time-to-start estimation
 *
 * Rule-based engine that turns a bundle status + blockers into a probability
 * score, an acceptance band, and per-blocker delay analysis. Designed to give
 * an employer a clear answer to "Can this clinician start? When? Why not?"
 */

export type AcceptanceBand = 'BLOCKED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DECISION_GRADE';

export type BestActionIntent = 'accept' | 'request_refresh' | 'route_to_review' | 'resolve_blockers';

export interface BlockerAnalysis {
  blocker: string;
  /** Calendar days to resolve, or null if not self-serviceable */
  delayDays: number | null;
  fixTime: string;
  /** Percentage point lift to probability if this blocker is resolved */
  acceptanceLift: number;
}

export interface BestAction {
  intent: BestActionIntent;
  label: string;
  reason: string;
  /** Days saved vs. routing everything to manual review */
  estimatedTimeSavedDays: number | null;
}

export interface AcceptanceAnalysis {
  /** 0–1 probability that this application will be accepted as-is */
  probability: number;
  band: AcceptanceBand;
  /** Estimated calendar days from today to clinician start, or null if blocked */
  estimatedDaysToStart: number | null;
  blockerAnalysis: BlockerAnalysis[];
  bestAction: BestAction;
}

export interface AcceptanceInput {
  status: 'unknown' | 'partial' | 'ready' | 'blocked';
  proofTier: 'none' | 'snapshot' | 'partial' | 'decision';
  blockers: string[];
  completeness: {
    verifiedSources: number;
    totalSources: number;
    missingSources: number;
  };
}

// ── Blocker delay model ───────────────────────────────────────────────────────

const BLOCKER_PATTERNS: Array<{
  pattern: RegExp;
  delayDays: number | null;
  fixTime: string;
  lift: number;
}> = [
  {
    pattern: /DEA|controlled.?substance/i,
    delayDays: 21,
    fixTime: '~3 weeks (federal registration)',
    lift: 0.35,
  },
  {
    pattern: /state.?licen|licen.?state/i,
    delayDays: 30,
    fixTime: '~4 weeks (state board processing)',
    lift: 0.30,
  },
  {
    pattern: /OIG|exclusion|excluded|LEIE/i,
    delayDays: null,
    fixTime: 'Not self-serviceable — requires legal resolution',
    lift: 0.40,
  },
  {
    pattern: /NPDB|adverse|malpractice.*(report|claim)/i,
    delayDays: 90,
    fixTime: '~3 months (NPDB dispute process)',
    lift: 0.40,
  },
  {
    pattern: /board.?cert|certification/i,
    delayDays: 45,
    fixTime: '~6 weeks (certification body processing)',
    lift: 0.20,
  },
  {
    pattern: /malpractice.?insurance/i,
    delayDays: 14,
    fixTime: '~2 weeks (insurance binding)',
    lift: 0.15,
  },
  {
    pattern: /expired/i,
    delayDays: 21,
    fixTime: '~3 weeks (renewal processing)',
    lift: 0.35,
  },
];

function analyzeBlocker(blocker: string): BlockerAnalysis {
  for (const entry of BLOCKER_PATTERNS) {
    if (entry.pattern.test(blocker)) {
      return {
        blocker,
        delayDays: entry.delayDays,
        fixTime: entry.fixTime,
        acceptanceLift: entry.lift,
      };
    }
  }
  return {
    blocker,
    delayDays: 14,
    fixTime: '~2 weeks (standard processing)',
    acceptanceLift: 0.10,
  };
}

// ── Probability model ─────────────────────────────────────────────────────────

function computeProbability(input: AcceptanceInput): number {
  switch (input.status) {
    case 'blocked':
      return 0.05;
    case 'unknown':
      return 0.15;
    case 'ready':
      return input.proofTier === 'decision' ? 0.90 : 0.75;
    case 'partial': {
      const base = input.blockers.length === 0 ? 0.58 : 0.42;
      const blockerPenalty = Math.min(0.30, input.blockers.length * 0.06);
      return Math.max(0.10, base - blockerPenalty);
    }
    default:
      return 0.15;
  }
}

function probabilityToBand(probability: number, status: AcceptanceInput['status']): AcceptanceBand {
  if (status === 'blocked') return 'BLOCKED';
  if (probability >= 0.85) return 'DECISION_GRADE';
  if (probability >= 0.65) return 'HIGH';
  if (probability >= 0.40) return 'MEDIUM';
  return 'LOW';
}

function computeEstimatedDaysToStart(
  input: AcceptanceInput,
  blockerAnalysis: BlockerAnalysis[],
): number | null {
  if (input.status === 'blocked') return null;
  if (input.status === 'unknown') return null;
  if (input.status === 'ready') {
    return input.proofTier === 'decision' ? 3 : 7;
  }

  // partial — worst-case blocker drives the estimate
  if (blockerAnalysis.length === 0) return 7;
  const maxDelay = blockerAnalysis.reduce<number | null>((worst, entry) => {
    if (entry.delayDays === null) return null;
    if (worst === null) return null;
    return Math.max(worst, entry.delayDays);
  }, 0);

  return maxDelay === null ? null : maxDelay + 5;
}

function computeBestAction(
  input: AcceptanceInput,
  blockerAnalysis: BlockerAnalysis[],
  probability: number,
): BestAction {
  if (input.status === 'blocked') {
    return {
      intent: 'route_to_review',
      label: 'Route to manual review',
      reason: 'Start is not possible until the active blocker is resolved. Escalate now rather than waiting.',
      estimatedTimeSavedDays: null,
    };
  }

  if (input.status === 'ready') {
    return {
      intent: 'accept',
      label: 'Accept as head start',
      reason: probability >= 0.85
        ? 'All required sources are checked and decision-grade. Accepting now gets the clinician started sooner.'
        : 'All required checks are present. Accepting as a head start keeps the process moving.',
      estimatedTimeSavedDays: 14,
    };
  }

  if (input.status === 'partial') {
    const hasUnfixableBlocker = blockerAnalysis.some((b) => b.delayDays === null);
    if (hasUnfixableBlocker) {
      return {
        intent: 'route_to_review',
        label: 'Route to manual review',
        reason: 'One or more blockers cannot be resolved without legal or institutional intervention.',
        estimatedTimeSavedDays: null,
      };
    }

    const refreshableGaps = blockerAnalysis.filter((b) => b.delayDays !== null && b.delayDays <= 30);
    if (refreshableGaps.length > 0) {
      return {
        intent: 'request_refresh',
        label: 'Request refresh',
        reason: `Fix ${refreshableGaps.map((b) => b.blocker).join(', ')} and re-run the check. This gets acceptance probability to ${Math.round(Math.min(0.88, probability + 0.30) * 100)}% faster than routing to full review.`,
        estimatedTimeSavedDays: 14,
      };
    }

    return {
      intent: 'resolve_blockers',
      label: 'Resolve blockers first',
      reason: 'Some checks are still incomplete. Request a refresh after the clinician resolves the outstanding items.',
      estimatedTimeSavedDays: 7,
    };
  }

  return {
    intent: 'request_refresh',
    label: 'Request refresh',
    reason: 'No verified source evidence yet. Run a check first before deciding.',
    estimatedTimeSavedDays: null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeAcceptanceAnalysis(input: AcceptanceInput): AcceptanceAnalysis {
  const blockerAnalysis = input.blockers.map(analyzeBlocker);
  const probability = computeProbability(input);
  const band = probabilityToBand(probability, input.status);
  const estimatedDaysToStart = computeEstimatedDaysToStart(input, blockerAnalysis);
  const bestAction = computeBestAction(input, blockerAnalysis, probability);

  return {
    probability,
    band,
    estimatedDaysToStart,
    blockerAnalysis,
    bestAction,
  };
}
