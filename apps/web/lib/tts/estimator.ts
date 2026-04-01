/**
 * Time-to-Start (TTS) estimator — client-side heuristic v1
 *
 * Computes an estimated time-to-start range for a clinician at a specific
 * employer, based on the employer's published requirements and the clinician's
 * current readiness snapshot.
 *
 * This is a heuristic, not a prediction. The estimate is always floored at
 * the employer's published base TTS and clearly labeled as approximate.
 */

export interface TTSEstimate {
  minDays: number;
  maxDays: number;
  confidence: 'high' | 'medium' | 'low';
  baselineDays: number;
  unmetRequirements: string[];
  metRequirements: string[];
  methodology: string;
}

export interface EmployerTTSInput {
  timeToStart: string;
  requirements: Array<{ label: string; level: string; note?: string }>;
}

export interface ClinicianTTSInput {
  identityVerified: boolean;
  exclusionClear: boolean;
  readinessLevel: string;
  readinessScore: number;
  gaps: string[];
  facts: Array<{ factType: string; status: string; details?: string }>;
}

// Requirement labels that can be checked against clinician trust state
const REQUIREMENT_MATCHERS: Record<string, (c: ClinicianTTSInput) => boolean> = {
  'npi verified': (c) => c.identityVerified,
  'npi': (c) => c.identityVerified,
  'sanctions clear': (c) => c.exclusionClear,
  'sanctions': (c) => c.exclusionClear,
  'oig': (c) => c.exclusionClear,
};

const READINESS_MULTIPLIER: Record<string, number> = {
  L3: 1.0,
  L2: 1.3,
  L1: 2.0,
  L0: 3.0,
};

const DAY_PATTERN = /(\d+)\s*(?:days?|d)/i;
const WEEK_PATTERN = /(\d+)\s*(?:weeks?|w)/i;

function parseTimeToStartDays(value: string): number {
  const dayMatch = value.match(DAY_PATTERN);
  if (dayMatch) return parseInt(dayMatch[1], 10);

  const weekMatch = value.match(WEEK_PATTERN);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;

  // Fallback: try to extract any number
  const numMatch = value.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return 14; // conservative default
}

function isRequirementMet(
  reqLabel: string,
  clinician: ClinicianTTSInput,
): boolean {
  const normalized = reqLabel.toLowerCase().trim();

  for (const [keyword, matcher] of Object.entries(REQUIREMENT_MATCHERS)) {
    if (normalized.includes(keyword)) {
      return matcher(clinician);
    }
  }

  // Check if any clinician gap mentions this requirement
  const gapMentionsReq = clinician.gaps.some(
    gap => gap.toLowerCase().includes(normalized) || normalized.includes(gap.toLowerCase()),
  );
  if (gapMentionsReq) return false;

  // Check if any clinician fact covers this requirement
  const factCoversReq = clinician.facts.some(
    f => f.status === 'VERIFIED' && f.details?.toLowerCase().includes(normalized),
  );
  if (factCoversReq) return true;

  // Unknown — conservatively assume unmet
  return false;
}

export function estimateTimeToStart(
  employer: EmployerTTSInput,
  clinician: ClinicianTTSInput,
): TTSEstimate {
  const baselineDays = parseTimeToStartDays(employer.timeToStart);
  const multiplier = READINESS_MULTIPLIER[clinician.readinessLevel] ?? READINESS_MULTIPLIER.L0;

  const met: string[] = [];
  const unmet: string[] = [];

  for (const req of employer.requirements) {
    if (isRequirementMet(req.label, clinician)) {
      met.push(req.label);
    } else {
      unmet.push(req.label);
    }
  }

  // Unmet L3 (hard-gate) requirements add significant time
  const hardGateUnmet = employer.requirements.filter(
    r => r.level === 'L3' && unmet.includes(r.label),
  ).length;
  const additionalDays = hardGateUnmet * 7; // ~1 week per hard-gate gap

  const rawMin = Math.ceil(baselineDays * multiplier) + additionalDays;
  const rawMax = Math.ceil(rawMin * 1.4); // 40% buffer for the upper bound

  // Floor: never estimate faster than the employer's published TTS
  const minDays = Math.max(rawMin, baselineDays);
  const maxDays = Math.max(rawMax, baselineDays + 7);

  const confidence: TTSEstimate['confidence'] =
    clinician.readinessLevel === 'L3' ? 'high'
    : clinician.readinessLevel === 'L2' ? 'medium'
    : 'low';

  return {
    minDays,
    maxDays,
    confidence,
    baselineDays,
    unmetRequirements: unmet,
    metRequirements: met,
    methodology: 'heuristic-v1',
  };
}
