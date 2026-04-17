/**
 * RD Classifier — wave-131: Classification Hardening
 *
 * Replaces first-match algorithm with scored multi-pattern evaluation.
 * Every classification is explainable, traceable, and deterministic.
 *
 * Priority rules are explicit — no implicit pattern ordering.
 * Confidence score surfaces ambiguity rather than hiding it.
 */

import type { RDCategory, RecommendedSystem, ImpactLevel } from './rd-pipeline';

// ─── Classification Rule ──────────────────────────────────────────

export interface ClassificationRule {
  category: RDCategory;
  patterns: RegExp[];
  baseScore: number;         // 0–100
  priority: number;          // lower = higher priority (1 = top)
  targetSystem: RecommendedSystem;
  impactLevel: ImpactLevel;
  actionTemplate: string;
  description: string;       // human-readable explanation
  exclusionPatterns?: RegExp[]; // if matched, rule is suppressed
}

// ─── Explicit Priority Rules (ordered, documented) ────────────────
// Lower priority number = evaluated first.
// When two rules score equally, higher priority (lower number) wins.

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Priority 1: Adverse / blocking findings — highest specificity
  {
    category: 'employer_trust',
    priority: 1,
    baseScore: 90,
    patterns: [
      /still have to verify/i,
      /verify (everything|it all|ourselves)/i,
      /do it ourselves/i,
      /trust (this|the data|it)/i,
      /re-?check/i,
    ],
    targetSystem: 'employer-surface',
    impactLevel: 'high',
    actionTemplate: 'Clarify what VitalCV replaces vs what employer still owns on employer review page',
    description: 'Employer does not trust that VitalCV reduces their verification burden',
  },

  // Priority 2: Data accuracy — specific claims about correctness
  {
    category: 'data_accuracy',
    priority: 2,
    baseScore: 90,
    patterns: [
      /fake|made.?up|synthetic|simulated/i,
      /(data|result).*(wrong|inaccurate|incorrect)/i,
      /where (does|did) (this|the data|it) come from/i,
      /can (you|i) verify (this|it)/i,
      /how (accurate|reliable) is/i,
    ],
    targetSystem: 'proof-page',
    impactLevel: 'high',
    actionTemplate: 'Increase source citation visibility on proof page — NPPES timestamp and audit link',
    description: 'Buyer questions the accuracy or origin of the data',
  },

  // Priority 3: Scope — OIG specifically (common and high-stakes)
  {
    category: 'scope_clarity',
    priority: 3,
    baseScore: 85,
    patterns: [
      /oig|exclusion|sanction|debarred|excluded/i,
      /state (license|board|medical board)/i,
      /caqh|joint commission|jcaho|ncqa|credentialing committee/i,
      /board certification|dea (number|registration)/i,
    ],
    targetSystem: 'proof-page',
    impactLevel: 'high',
    actionTemplate: 'Surface specific missing lane on proof page — which sources are and are not integrated',
    description: 'Buyer confused or concerned about specific credential sources not covered',
  },

  // Priority 4: Competitive — named competitors (more specific than integration)
  {
    category: 'competitive_comparison',
    priority: 4,
    baseScore: 80,
    patterns: [
      /medallion|verifiable|symplr|hireright|verisys|modio/i,
      /different from|compared to|versus|vs\.?|better than/i,
      /already (use|have|work with)/i,
    ],
    exclusionPatterns: [
      // "already verify" → employer_trust, not competitive
      /already (verify|check|validate)/i,
    ],
    targetSystem: 'outreach-messaging',
    impactLevel: 'medium',
    actionTemplate: 'Add one-line competitive differentiation to objection handling doc',
    description: 'Buyer comparing VitalCV to a named competitor or existing tool',
  },

  // Priority 5: Integration — connecting to systems (no competitor names)
  {
    category: 'integration_concern',
    priority: 5,
    baseScore: 70,
    patterns: [
      /integrate|integration|api|connect (to|with)/i,
      /our (system|platform|ats|workflow|tools)/i,
      /plug.?in|webhook|sync/i,
    ],
    targetSystem: 'onboarding',
    impactLevel: 'medium',
    actionTemplate: 'Add clear "no integration required for pilot" statement to pilot agreement',
    description: 'Buyer concerned about technical integration with existing systems',
  },

  // Priority 6: Pricing / ROI
  {
    category: 'pricing_friction',
    priority: 6,
    baseScore: 70,
    patterns: [
      /price|cost|expensive|budget|afford|worth it/i,
      /how much (does|will|would)/i,
      /roi|return|payback|justify/i,
    ],
    targetSystem: 'pilot-agreement',
    impactLevel: 'medium',
    actionTemplate: 'Add ROI framing: cost per clinician vs current ops cost estimate',
    description: 'Buyer is evaluating cost-benefit or expressing price concern',
  },

  // Priority 7: Workflow fit
  {
    category: 'workflow_fit',
    priority: 7,
    baseScore: 65,
    patterns: [
      /our (workflow|process|team|way)/i,
      /how (does|would|can) (this|it) (fit|work)/i,
      /current(ly)? (do|use|have)/i,
    ],
    targetSystem: 'onboarding',
    impactLevel: 'medium',
    actionTemplate: 'Add workflow integration description to pilot offer doc',
    description: 'Buyer unsure how VitalCV fits into their existing process',
  },

  // Priority 8: Language / terminology confusion
  {
    category: 'proof_language',
    priority: 8,
    baseScore: 60,
    patterns: [
      /confus(ed|ing)|unclear|don.?t understand/i,
      /what (does|do|is) .{0,40} mean/i,
      /what is (a |the )?(partial|proof pack|decision.grade|posture)/i,
      /what.s (a |the )?(partial|proof pack|decision.grade|posture)/i,
      /decision.grade|proof.pack|readiness.posture/i,
    ],
    targetSystem: 'proof-page',
    impactLevel: 'medium',
    actionTemplate: 'Simplify proof page terminology — replace technical terms with buyer-language',
    description: 'Buyer confused by terminology or phrasing on the proof page or in conversation',
  },

  // Priority 9: Timeline
  {
    category: 'timeline_concern',
    priority: 9,
    baseScore: 55,
    patterns: [
      /how (long|soon|quickly|fast)/i,
      /(when|timeline|deadline|urgency)/i,
      /30 days (is|seems) (too|not)/i,
    ],
    targetSystem: 'pilot-agreement',
    impactLevel: 'low',
    actionTemplate: 'Add flexible timeline option to pilot scope discussion',
    description: 'Buyer concerned about pilot duration or urgency mismatch',
  },

  // Priority 10: Other / unclassified — lowest
  {
    category: 'other',
    priority: 10,
    baseScore: 10,
    patterns: [/.+/], // matches everything — fallback only
    targetSystem: 'none',
    impactLevel: 'low',
    actionTemplate: 'Review manually — no automated classification available',
    description: 'Input does not match any known pattern',
  },
];

// ─── Classification Result ────────────────────────────────────────

export interface ClassificationResult {
  category: RDCategory;
  confidence: number;       // 0–100
  reasoning: string;
  matchedPatterns: string[];
  rejectedRules: Array<{ rule: string; reason: string }>;
  allScores: Array<{ category: RDCategory; score: number }>;
  targetSystem: RecommendedSystem;
  impactLevel: ImpactLevel;
  actionTemplate: string;
}

// ─── Scorer ────────────────────────────────────────────────────────

export function classifyInput(content: string): ClassificationResult {
  const scores: Array<{
    rule: ClassificationRule;
    score: number;
    matchedPatterns: string[];
    excluded: boolean;
    exclusionReason?: string;
  }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    // Check exclusion patterns first
    if (rule.exclusionPatterns) {
      const excluded = rule.exclusionPatterns.find(ep => ep.test(content));
      if (excluded) {
        scores.push({
          rule,
          score: 0,
          matchedPatterns: [],
          excluded: true,
          exclusionReason: `Suppressed by exclusion pattern: ${excluded}`,
        });
        continue;
      }
    }

    // Count matching patterns
    const matched = rule.patterns.filter(p => p.test(content));
    if (matched.length === 0) {
      scores.push({ rule, score: 0, matchedPatterns: [], excluded: false });
      continue;
    }

    // Score = baseScore * pattern coverage ratio * priority bonus
    const coverageRatio = matched.length / rule.patterns.length;
    const priorityBonus = (10 - Math.min(rule.priority, 10)) * 2; // higher priority = more bonus
    const rawScore = Math.min(100, rule.baseScore * coverageRatio + priorityBonus);

    scores.push({
      rule,
      score: rawScore,
      matchedPatterns: matched.map(p => p.toString()),
      excluded: false,
    });
  }

  // Sort: by score desc, then by priority asc (tiebreaker)
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.rule.priority - b.rule.priority;
  });

  const winner = scores[0];
  const otherScores = scores.filter(s => s !== winner && s.score > 0);

  // Confidence: how much better is the winner vs second place
  const secondScore = scores[1]?.score ?? 0;
  const gap = winner.score - secondScore;
  const confidence = Math.min(100, Math.max(0, Math.round(winner.score * (gap > 20 ? 1.0 : gap > 10 ? 0.85 : 0.7))));

  const reasoning = winner.score <= 10
    ? `No specific pattern matched. Fell back to "${winner.rule.category}" (priority ${winner.rule.priority}).`
    : `Matched ${winner.matchedPatterns.length}/${winner.rule.patterns.length} patterns for "${winner.rule.category}". ${winner.rule.description}. Gap vs next: ${gap.toFixed(0)} points.`;

  const rejectedRules = scores
    .filter(s => s.excluded)
    .map(s => ({ rule: s.rule.category, reason: s.exclusionReason ?? 'excluded' }));

  return {
    category: winner.rule.category,
    confidence,
    reasoning,
    matchedPatterns: winner.matchedPatterns,
    rejectedRules,
    allScores: scores.map(s => ({ category: s.rule.category, score: Math.round(s.score) })),
    targetSystem: winner.rule.targetSystem,
    impactLevel: winner.rule.impactLevel,
    actionTemplate: winner.rule.actionTemplate,
  };
}
