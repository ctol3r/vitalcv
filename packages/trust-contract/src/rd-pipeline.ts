/**
 * RD Pipeline — Research & Development Feedback Loop
 * wave-127: Live Conversation → Product Input
 *
 * Converts raw buyer objections into structured product insights.
 * Every insight either produces a patch or a documented non-action.
 * Nothing gets ignored.
 */

// ─── Raw Input ─────────────────────────────────────────────────────

export type RDInputSource =
  | 'buyer_call'
  | 'buyer_email'
  | 'pilot_session'
  | 'internal_review'
  | 'user_confusion';

export interface RDInput {
  id: string;
  source: RDInputSource;
  content: string;      // raw buyer language — never paraphrased
  timestamp: number;
  context?: {
    org?: string;
    role?: string;
    stage?: string;     // e.g. "first_call", "post_pilot"
  };
}

// ─── Validated Input ───────────────────────────────────────────────

export interface RDValidated extends RDInput {
  valid: boolean;
  rejectionReason?: string;
}

/**
 * RD_VALIDATOR: rejects inputs that are synthetic, paraphrased,
 * or lack minimum content to be actionable.
 */
export function validateRDInput(input: RDInput): RDValidated {
  if (!input.content || input.content.trim().length < 10) {
    return { ...input, valid: false, rejectionReason: 'Content too short — must be raw buyer language' };
  }
  if (!input.timestamp || input.timestamp <= 0) {
    return { ...input, valid: false, rejectionReason: 'Missing timestamp' };
  }
  if (input.content.includes('[SIMULATED]') || input.content.includes('[HYPOTHETICAL]')) {
    return { ...input, valid: false, rejectionReason: 'Simulated inputs are not permitted' };
  }
  return { ...input, valid: true };
}

// ─── Insight ────────────────────────────────────────────────────────

export type RDCategory =
  | 'employer_trust'        // employer doesn't trust the proof
  | 'scope_clarity'         // buyer unclear on what is/isn't covered
  | 'integration_concern'   // worried about connecting to existing systems
  | 'pricing_friction'      // price objection
  | 'data_accuracy'         // skeptical about data quality
  | 'workflow_fit'          // doesn't see how it fits their process
  | 'proof_language'        // confused by terminology on proof page
  | 'competitive_comparison' // comparing to Medallion/Verifiable/etc
  | 'timeline_concern'      // wants faster results or longer pilot
  | 'other';

export type ImpactLevel = 'high' | 'medium' | 'low';

export type RecommendedSystem =
  | 'trust-engine'
  | 'employer-surface'
  | 'proof-pack'
  | 'onboarding'
  | 'proof-page'
  | 'outreach-messaging'
  | 'pilot-agreement'
  | 'none';

export interface RDInsight {
  id: string;
  sourceInputId: string;
  category: RDCategory;
  impactLevel: ImpactLevel;
  summary: string;
  rawEvidence: string;    // preserved buyer language
  recommendedAction: string;
  targetSystem: RecommendedSystem;
  wave?: string;          // if routed to a wave, which one
  resolved: boolean;
  resolution?: 'patched' | 'deferred' | 'wont_fix' | 'pending';
  resolutionNote?: string;
}

// ─── RD Agent (uses rd-classifier.ts) ────────────────────────────
// The old first-match pattern array has been replaced by the scored
// multi-pattern classifier in rd-classifier.ts (wave-131).

import { classifyInput, type ClassificationResult } from './rd-classifier';

export { classifyInput };  // re-export for consumers

/**
 * RD_AGENT: classifies a validated input using scored multi-pattern evaluation.
 * Returns an RDInsight with category, confidence, and reasoning.
 */
export function runRDAgent(input: RDValidated): RDInsight & { classification: ClassificationResult } | null {
  if (!input.valid) return null;

  const classification = classifyInput(input.content);

  return {
    id: `rdi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceInputId: input.id,
    category: classification.category,
    impactLevel: classification.impactLevel,
    summary: `[${classification.category}] conf:${classification.confidence}% — ${input.content.slice(0, 60)}${input.content.length > 60 ? '…' : ''}`,
    rawEvidence: input.content,
    recommendedAction: classification.actionTemplate,
    targetSystem: classification.targetSystem,
    resolved: false,
    resolution: 'pending',
    classification,  // full traceability
  };
}

// ─── RD Router

// ─── RD Router ─────────────────────────────────────────────────────

export interface RouteDecision {
  insight: RDInsight;
  action: 'patch_now' | 'next_wave' | 'deferred' | 'wont_fix';
  rationale: string;
  waveTarget?: string;
}

/**
 * RD_ROUTER: decides what to do with each insight.
 * High-impact insights must be acted on or explicitly rejected.
 */
export function routeInsight(insight: RDInsight): RouteDecision {
  // High-impact employer trust or scope clarity = patch now
  if (
    insight.impactLevel === 'high' &&
    ['employer_trust', 'scope_clarity', 'data_accuracy'].includes(insight.category)
  ) {
    return {
      insight,
      action: 'patch_now',
      rationale: `High-impact ${insight.category} issue — blocks pilot conversion`,
    };
  }

  // Medium-impact = next wave
  if (insight.impactLevel === 'medium') {
    return {
      insight,
      action: 'next_wave',
      rationale: `Medium-impact ${insight.category} — queue for next product wave`,
      waveTarget: 'wave-128',
    };
  }

  // Low-impact other = deferred
  return {
    insight,
    action: 'deferred',
    rationale: 'Low-impact or uncategorized — review in weekly backlog',
  };
}

// ─── Full Pipeline ──────────────────────────────────────────────────

export interface RDPipelineResult {
  input: RDInput;
  validated: RDValidated;
  insight: RDInsight | null;
  routeDecision: RouteDecision | null;
  closedLoop: boolean; // true when resolution is set
}

export function runRDPipeline(raw: Omit<RDInput, 'id'>): RDPipelineResult {
  const input: RDInput = {
    ...raw,
    id: `rdi-input-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };

  const validated = validateRDInput(input);
  if (!validated.valid) {
    return { input, validated, insight: null, routeDecision: null, closedLoop: false };
  }

  const insight = runRDAgent(validated);
  const routeDecision = insight ? routeInsight(insight) : null;

  return {
    input,
    validated,
    insight,
    routeDecision,
    closedLoop: false, // set to true when resolution is recorded
  };
}

// ─── Close Loop ─────────────────────────────────────────────────────

export function closeLoop(
  result: RDPipelineResult,
  resolution: RDInsight['resolution'],
  note: string
): RDPipelineResult {
  if (!result.insight) return result;
  return {
    ...result,
    insight: { ...result.insight, resolved: true, resolution, resolutionNote: note },
    closedLoop: true,
  };
}

// ─── Patch Classification (wave-129) ─────────────────────────────

export type PatchType  = 'patch_now' | 'next_wave' | 'ignore';
export type PatchScope = 'ui' | 'copy' | 'logic' | 'flow';

export interface RDAction {
  type: PatchType;
  target: string;        // file or component name
  priority: number;      // 1 = highest
  patchScope: PatchScope;
  description: string;
  validationQuestion: string; // "Would this objection still happen after patch?"
}

// Categories that require patch within 24 hours
const PATCH_NOW_CATEGORIES = new Set<RDCategory>([
  'employer_trust',
  'scope_clarity',
  'data_accuracy',
  'proof_language',
]);

const SCOPE_MAP: Partial<Record<RecommendedSystem, PatchScope>> = {
  'employer-surface': 'ui',
  'proof-page':       'copy',
  'onboarding':       'copy',
  'trust-engine':     'logic',
  'outreach-messaging': 'copy',
  'pilot-agreement':  'copy',
};

const PRIORITY_MAP: Record<ImpactLevel, number> = {
  high:   1,
  medium: 2,
  low:    3,
};

export function classifyPatch(insight: RDInsight): RDAction {
  const type: PatchType =
    PATCH_NOW_CATEGORIES.has(insight.category) && insight.impactLevel === 'high'
      ? 'patch_now'
      : insight.impactLevel === 'medium'
      ? 'next_wave'
      : 'ignore';

  const scope: PatchScope = SCOPE_MAP[insight.targetSystem] ?? 'copy';

  return {
    type,
    target: insight.targetSystem === 'none' ? 'docs/LIVE_OBJECTION_RESPONSE.md' : insight.targetSystem,
    priority: PRIORITY_MAP[insight.impactLevel],
    patchScope: scope,
    description: insight.recommendedAction,
    validationQuestion: `After this patch, would a buyer still say: "${insight.rawEvidence.slice(0, 60)}..."?`,
  };
}

// ─── Patch Record ─────────────────────────────────────────────────

export type PatchStatus = 'patched' | 'deferred' | 'rejected' | 'pending';

export interface PatchRecord {
  id: string;
  insightId: string;
  action: RDAction;
  originalObjection: string;
  changeDescription: string;
  filesChanged: string[];
  patchedAt: number | null;
  validationResult: 'objection_resolved' | 'objection_remains' | 'unvalidated';
  status: PatchStatus;
  rejectionReason?: string;
}

export function createPatchRecord(insight: RDInsight): PatchRecord {
  return {
    id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    insightId: insight.id,
    action: classifyPatch(insight),
    originalObjection: insight.rawEvidence,
    changeDescription: '',    // filled when patch is applied
    filesChanged: [],
    patchedAt: null,
    validationResult: 'unvalidated',
    status: 'pending',
  };
}

export function recordPatchApplied(
  record: PatchRecord,
  changeDescription: string,
  filesChanged: string[],
  validationResult: PatchRecord['validationResult']
): PatchRecord {
  return {
    ...record,
    changeDescription,
    filesChanged,
    patchedAt: Date.now(),
    validationResult,
    status: validationResult === 'objection_resolved' ? 'patched' : 'pending',
  };
}

export function rejectPatch(record: PatchRecord, reason: string): PatchRecord {
  return { ...record, status: 'rejected', rejectionReason: reason };
}

export function deferPatch(record: PatchRecord): PatchRecord {
  return { ...record, status: 'deferred' };
}
