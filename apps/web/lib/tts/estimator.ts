/**
 * TTS (Time-To-Start) Estimator — heuristic-v1
 *
 * Pure function that estimates how long it would take a clinician to start
 * at a specific employer, based on the employer's published TTS and the
 * clinician's current readiness level + gap analysis.
 *
 * Guardrails:
 *   - Result is always >= employer's published base TTS (never claims faster)
 *   - Always labeled "Estimated" — not a guarantee
 *   - Methodology version is embedded in the result for auditability
 */

// ── Input types ─────────────────────────────────────────────────

export interface EmployerTTSInput {
  name: string;
  timeToStart: string;           // e.g. "2-3 weeks"
  requirements: Array<{
    label: string;
    level: string;               // "L1" | "L2" | "L3"
    note?: string;
  }>;
}

export interface ClinicianTTSInput {
  readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
  readinessScore: number;
  gaps: string[];
  facts: Array<{
    factType: string;
    status: string;
  }>;
}

// ── Output type ─────────────────────────────────────────────────

export interface TTSEstimate {
  minDays: number;
  maxDays: number;
  confidence: 'high' | 'medium' | 'low';
  baselineDays: number;
  unmetRequirements: string[];
  metRequirements: string[];
  methodology: string;
}

// ── Helpers ─────────────────────────────────────────────────────

const READINESS_MULTIPLIER: Record<string, number> = {
  L3: 1.0,
  L2: 1.3,
  L1: 2.0,
  L0: 3.0,
};

const HARD_GATE_PENALTY_DAYS = 7;

/**
 * Parse a human-readable TTS string into a day count.
 * Examples: "2-3 weeks" → 14, "10 business days" → 14, "1 month" → 30
 */
function parseTTSToDays(tts: string): number {
  const lower = tts.toLowerCase().trim();

  // "X-Y weeks"
  const weekRange = lower.match(/(\d+)\s*-\s*(\d+)\s*week/);
  if (weekRange) {
    return Math.round(((Number(weekRange[1]) + Number(weekRange[2])) / 2) * 7);
  }

  // "X weeks"
  const singleWeek = lower.match(/(\d+)\s*week/);
  if (singleWeek) {
    return Number(singleWeek[1]) * 7;
  }

  // "X business days"
  const bizDays = lower.match(/(\d+)\s*business\s*day/);
  if (bizDays) {
    return Math.round(Number(bizDays[1]) * 1.4); // business → calendar
  }

  // "X days"
  const days = lower.match(/(\d+)\s*day/);
  if (days) {
    return Number(days[1]);
  }

  // "X month(s)"
  const months = lower.match(/(\d+)\s*month/);
  if (months) {
    return Number(months[1]) * 30;
  }

  return 21; // fallback: 3 weeks
}

/**
 * Check if a clinician fact matches an employer requirement via keyword matching.
 */
function requirementMet(
  reqLabel: string,
  facts: ClinicianTTSInput['facts'],
  gaps: string[],
): boolean {
  const keywords = reqLabel.toLowerCase().split(/\s+/);

  // If any gap mentions this requirement, it's unmet
  for (const gap of gaps) {
    const gapLower = gap.toLowerCase();
    if (keywords.some(kw => kw.length > 2 && gapLower.includes(kw))) {
      return false;
    }
  }

  // Check if any fact covers this requirement
  for (const fact of facts) {
    const factLower = fact.factType.toLowerCase();
    if (keywords.some(kw => kw.length > 2 && factLower.includes(kw))) {
      return fact.status === 'verified' || fact.status === 'VERIFIED' || fact.status === 'active';
    }
  }

  // No matching fact found — conservatively treat as unmet
  return false;
}

// ── Main estimator ──────────────────────────────────────────────

export function estimateTimeToStart(
  employer: EmployerTTSInput,
  clinician: ClinicianTTSInput,
): TTSEstimate {
  const baselineDays = parseTTSToDays(employer.timeToStart);
  const multiplier = READINESS_MULTIPLIER[clinician.readinessLevel] ?? 3.0;

  const metRequirements: string[] = [];
  const unmetRequirements: string[] = [];
  let hardGatePenalty = 0;

  for (const req of employer.requirements) {
    const met = requirementMet(req.label, clinician.facts, clinician.gaps);
    if (met) {
      metRequirements.push(req.label);
    } else {
      unmetRequirements.push(req.label);
      if (req.level === 'L3') {
        hardGatePenalty += HARD_GATE_PENALTY_DAYS;
      }
    }
  }

  const rawDays = baselineDays * multiplier + hardGatePenalty;

  // Floor at employer's published TTS
  const adjustedDays = Math.max(rawDays, baselineDays);

  // Build range (±20%)
  const minDays = Math.max(Math.round(adjustedDays * 0.8), baselineDays);
  const maxDays = Math.round(adjustedDays * 1.2);

  const confidence: TTSEstimate['confidence'] =
    clinician.readinessLevel === 'L3' ? 'high'
    : clinician.readinessLevel === 'L2' ? 'medium'
    : 'low';

  return {
    minDays,
    maxDays,
    confidence,
    baselineDays,
    unmetRequirements,
    metRequirements,
    methodology: 'heuristic-v1',
  };
}
