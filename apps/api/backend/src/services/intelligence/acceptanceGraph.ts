/**
 * acceptanceGraph.ts — Predictive Acceptance Engine (MVP Scaffold)
 *
 * Takes a clinician's current passport state and a target employer, and
 * returns a calibrated confidence band + gap-boost recommendations based
 * on historical DecisionLearningCapsule rows.
 *
 * Rules-based, not ML. By design:
 *   - Every confidence band is explained by a concrete reason.
 *   - When there is not enough history, we say so (LOW, acceptanceRate=null)
 *     instead of inventing certainty.
 *   - Missing mandatory credentials short-circuit to BLOCKER regardless
 *     of historical acceptance — this is a policy floor, not a prediction.
 *
 * Tunable constants are declared at the top of the file. They're the
 * obvious place for product/clinical ops to refine the heuristic without
 * rewriting the engine.
 */

import prisma from '../../graphql/prisma_client';

// ── Types ─────────────────────────────────────────────────────────────

export type AcceptanceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';

export interface PassportState {
  /** Readiness tier at the moment of evaluation */
  readinessBand?: 'L0' | 'L1' | 'L2' | 'L3';
  readinessScore?: number;
  /** Credential type codes currently on file (e.g. "STATE_BOARD_LICENSE", "DEA") */
  credentialTypes?: string[];
  /** Known gaps the clinician hasn't filled yet */
  gaps?: string[];
  /** US state the credentials apply to (e.g. "CA") */
  state?: string;
  specialty?: string;
  /** Free-form extension fields — ignored by the signature */
  [key: string]: unknown;
}

export interface GapBoost {
  credential: string;
  /** Absolute acceptance-rate lift in the network when this credential is present */
  boostPct: number;
  /** Network sample size that supports the boost claim */
  sampleSize: number;
}

export interface AcceptancePrediction {
  confidence: AcceptanceConfidence;
  /** null when we refuse to guess (insufficient history) */
  acceptanceRate: number | null;
  reasons: string[];
  gapBoosts: GapBoost[];
  basedOn: {
    employerHistoryCount: number;
    networkNeighborsCount: number;
  };
}

type LearningDecisionOutcome =
  | 'ACCEPTED_HEAD_START'
  | 'REQUESTED_INFO'
  | 'ROUTED_MANUAL'
  | 'REJECTED';

// ── Tunables ──────────────────────────────────────────────────────────

/** A credential absent from the passport auto-triggers BLOCKER. Policy floor. */
const MANDATORY_CREDENTIALS = ['STATE_BOARD_LICENSE'] as const;

/** Employer history needs at least this many matches before we emit HIGH. */
const EMPLOYER_MIN_SAMPLE = 3;
/** Employer-level acceptance rate above which we call it HIGH. */
const EMPLOYER_HIGH_THRESHOLD = 0.7;

/** Network neighbours need at least this many matches before we emit MEDIUM. */
const NETWORK_MIN_SAMPLE = 5;
/** Network-level acceptance rate above which we call it MEDIUM (else LOW). */
const NETWORK_MEDIUM_THRESHOLD = 0.5;

/** Only surface gap boosts with enough evidence and a meaningful lift. */
const GAP_MIN_SAMPLE = 5;
const GAP_MIN_BOOST_PCT = 20;
const GAP_TOP_N = 3;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Stable signature of a passport state for comparing two clinicians'
 * decision-time snapshots. Deliberately coarse — we're asking "is this
 * the same *kind* of state?", not "is this the same bytes?".
 *
 * Tune this if product decides e.g. specialty shouldn't gate matching.
 */
function signatureOf(state: PassportState | null | undefined): string {
  if (!state) return 'EMPTY';
  const sortedCreds = [...(state.credentialTypes ?? [])].sort().join('|');
  return [
    state.readinessBand ?? 'L0',
    sortedCreds || '∅',
    state.state ?? '∅',
    state.specialty ?? '∅',
  ].join('::');
}

function missingMandatory(state: PassportState): string | null {
  const present = new Set(state.credentialTypes ?? []);
  for (const c of MANDATORY_CREDENTIALS) {
    if (!present.has(c)) return c;
  }
  return null;
}

function computeGapBoosts(
  passport: PassportState,
  networkHistory: Array<{ passportSnapshot: unknown; decisionOutcome: string }>,
): GapBoost[] {
  const current = new Set(passport.credentialTypes ?? []);

  // tally[credential] = { withCred: total rows whose snapshot included it, accepted: those that were accepted }
  const tally = new Map<string, { withCred: number; accepted: number }>();

  for (const entry of networkHistory) {
    const snap = entry.passportSnapshot as PassportState | null;
    const creds = snap?.credentialTypes;
    if (!Array.isArray(creds)) continue;
    for (const cred of creds) {
      if (typeof cred !== 'string') continue;
      if (current.has(cred)) continue; // only *gaps* — credentials the clinician lacks
      const t = tally.get(cred) ?? { withCred: 0, accepted: 0 };
      t.withCred += 1;
      if (entry.decisionOutcome === 'ACCEPTED_HEAD_START') t.accepted += 1;
      tally.set(cred, t);
    }
  }

  const boosts: GapBoost[] = [];
  for (const [credential, t] of tally) {
    if (t.withCred < GAP_MIN_SAMPLE) continue;
    const boostPct = Math.round((t.accepted / t.withCred) * 100);
    if (boostPct < GAP_MIN_BOOST_PCT) continue;
    boosts.push({ credential, boostPct, sampleSize: t.withCred });
  }

  boosts.sort((a, b) => b.boostPct - a.boostPct);
  return boosts.slice(0, GAP_TOP_N);
}

function isResolvedLearningOutcome(decisionOutcome: string): decisionOutcome is Exclude<LearningDecisionOutcome, 'REQUESTED_INFO'> {
  return decisionOutcome === 'ACCEPTED_HEAD_START'
    || decisionOutcome === 'ROUTED_MANUAL'
    || decisionOutcome === 'REJECTED';
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Given a clinician's current passport state and a target employer,
 * returns a calibrated acceptance prediction.
 *
 * Reads from `DecisionLearningCapsule`. No writes, no side effects.
 */
export async function predictAcceptance(
  passport: PassportState,
  targetEmployerId: string,
): Promise<AcceptancePrediction> {
  const reasons: string[] = [];

  // 1. Policy floor — BLOCKER short-circuit
  const blocker = missingMandatory(passport);
  if (blocker) {
    return {
      confidence: 'BLOCKER',
      acceptanceRate: null,
      reasons: [`Missing mandatory credential: ${blocker}`],
      gapBoosts: [],
      basedOn: { employerHistoryCount: 0, networkNeighborsCount: 0 },
    };
  }

  const passportSig = signatureOf(passport);

  // 2. Employer-level history
  const employerHistory = await prisma.decisionLearningCapsule.findMany({
    where: { employerId: targetEmployerId },
    select: { passportSnapshot: true, decisionOutcome: true },
    take: 500,
  });

  const employerMatching = employerHistory.filter(
    (row) => isResolvedLearningOutcome(row.decisionOutcome) && signatureOf(row.passportSnapshot as PassportState) === passportSig,
  );
  const employerAccepted = employerMatching.filter(
    (row) => row.decisionOutcome === 'ACCEPTED_HEAD_START',
  ).length;

  if (employerMatching.length >= EMPLOYER_MIN_SAMPLE) {
    const rate = employerAccepted / employerMatching.length;
    reasons.push(
      `This employer accepted ${employerAccepted}/${employerMatching.length} identical passport states`,
    );
    return {
      confidence: rate >= EMPLOYER_HIGH_THRESHOLD ? 'HIGH' : 'LOW',
      acceptanceRate: rate,
      reasons,
      gapBoosts: [],
      basedOn: {
        employerHistoryCount: employerMatching.length,
        networkNeighborsCount: 0,
      },
    };
  }

  // 3. Network-neighbour fallback (different employers, similar role)
  const networkHistory = await prisma.decisionLearningCapsule.findMany({
    where: {
      employerId: { not: targetEmployerId },
      ...(passport.specialty
        ? { role: { contains: passport.specialty, mode: 'insensitive' as const } }
        : {}),
    },
    select: { passportSnapshot: true, decisionOutcome: true },
    take: 500,
  });

  const networkMatching = networkHistory.filter(
    (row) => isResolvedLearningOutcome(row.decisionOutcome) && signatureOf(row.passportSnapshot as PassportState) === passportSig,
  );
  const networkAccepted = networkMatching.filter(
    (row) => row.decisionOutcome === 'ACCEPTED_HEAD_START',
  ).length;

  const gapBoosts = computeGapBoosts(passport, networkHistory);

  if (networkMatching.length >= NETWORK_MIN_SAMPLE) {
    const rate = networkAccepted / networkMatching.length;
    reasons.push(
      `${networkAccepted}/${networkMatching.length} similar roles in the network accepted this state`,
    );
    return {
      confidence: rate >= NETWORK_MEDIUM_THRESHOLD ? 'MEDIUM' : 'LOW',
      acceptanceRate: rate,
      reasons,
      gapBoosts,
      basedOn: {
        employerHistoryCount: employerMatching.length,
        networkNeighborsCount: networkMatching.length,
      },
    };
  }

  // 4. Insufficient history — don't fake certainty
  reasons.push('Insufficient network history — prediction unavailable');
  return {
    confidence: 'LOW',
    acceptanceRate: null,
    reasons,
    gapBoosts,
    basedOn: {
      employerHistoryCount: employerMatching.length,
      networkNeighborsCount: networkMatching.length,
    },
  };
}

// Internal helpers exported for unit tests — do not import from routes.
export const __testing__ = {
  signatureOf,
  missingMandatory,
  computeGapBoosts,
  isResolvedLearningOutcome,
};
