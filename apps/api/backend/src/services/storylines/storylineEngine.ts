/**
 * storylineEngine.ts — VitalCV Storyline Engine
 *
 * Storylines sit ABOVE findings and BELOW investigations.
 *
 *   Findings = atomic signals ("trust score dropped 12 pts")
 *   Storylines = evolving narratives that cluster related findings
 *                ("Provider X has been deteriorating for 3 weeks:
 *                  trust decline → freshness decay → divergence detected")
 *   Investigations = deep-dive dossiers triggered by a storyline or user query
 *
 * A storyline:
 *   1. Groups related findings by NPI + category affinity
 *   2. Tracks evolution over time (new findings extend the storyline)
 *   3. Has a lifecycle: EMERGING → DEVELOPING → MATURE → RESOLVED
 *   4. Provides a narrative summary that explains the arc
 *   5. Links to provider profiles, graph context, evidence, and actions
 *
 * Storylines are NOT notifications. They are the intelligence layer's
 * primary unit of analysis, surfaced natively in search, graph, copilot,
 * and investigation mode.
 */

import { log } from '../../obs/logger';
import type {
  Finding,
  FindingCategory,
  FindingSeverity,
  FeedbackAction,
} from '../investigators/framework';
import { queryFindings, getFindingById } from '../investigators/framework';

// ── Types ──────────────────────────────────────────────────────────────────────

export type StorylineType =
  | 'TRUST_RISK'
  | 'RISING_INVESTIGATOR'
  | 'NETWORK_EMERGENCE'
  | 'WORKFORCE_OPPORTUNITY'
  | 'INDUSTRY_INFLUENCE'
  | 'INSTITUTION_SHIFT'
  | 'COMPLIANCE_ARC'
  | 'FRESHNESS_DEGRADATION';

export type StorylineStage = 'EMERGING' | 'DEVELOPING' | 'MATURE' | 'RESOLVED';

export interface StorylineEvent {
  findingId:   string;
  category:    FindingCategory;
  severity:    FindingSeverity;
  title:       string;
  timestamp:   string;
  score:       number;
}

export interface StorylineAction {
  id:       string;
  label:    string;
  type:     'investigate' | 'verify' | 'monitor' | 'compare' | 'dismiss' | 'escalate' | 'archive';
  payload:  Record<string, unknown>;
}

export interface Storyline {
  id:             string;
  type:           StorylineType;
  stage:          StorylineStage;
  title:          string;
  narrative:      string;       // Multi-sentence evolving summary
  npis:           string[];     // All NPIs involved
  primaryNpi:     string | null;
  findingIds:     string[];     // Chronological finding IDs
  timeline:       StorylineEvent[];
  severity:       FindingSeverity;  // Escalates with new findings
  score:          number;       // Composite ranking (0–100)
  actions:        StorylineAction[];
  relatedStorylines: string[];
  metadata:       Record<string, unknown>;
  createdAt:      string;
  updatedAt:      string;
  resolvedAt:     string | null;
  status:         'ACTIVE' | 'ACKNOWLEDGED' | 'ARCHIVED' | 'RESOLVED';
  feedbackCount:  number;
}

// ── Storyline Store ────────────────────────────────────────────────────────────

const storylines: Storyline[] = [];
const MAX_STORYLINES = 200;
let storylineCounter = 0;

function makeStorylineId(): string {
  return `sty_${Date.now().toString(36)}_${(++storylineCounter).toString(36)}`;
}

// ── Affinity Rules ─────────────────────────────────────────────────────────────
//
// Which finding categories cluster into which storyline types?
//

const CATEGORY_TO_STORYLINE: Record<FindingCategory, StorylineType> = {
  TRUST_DECLINE:       'TRUST_RISK',
  DIVERGENCE:          'TRUST_RISK',
  FRESHNESS:           'FRESHNESS_DEGRADATION',
  NETWORK_EMERGENCE:   'NETWORK_EMERGENCE',
  RESEARCH_MOMENTUM:   'RISING_INVESTIGATOR',
  WORKFORCE_PRESSURE:  'WORKFORCE_OPPORTUNITY',
  INDUSTRY_INFLUENCE:  'INDUSTRY_INFLUENCE',
  EXCLUSION:           'COMPLIANCE_ARC',
  COMPLIANCE:          'COMPLIANCE_ARC',
};

// Cross-category affinities: these categories merge into the same storyline
// when they share NPIs
const AFFINITY_GROUPS: FindingCategory[][] = [
  ['TRUST_DECLINE', 'DIVERGENCE', 'FRESHNESS', 'EXCLUSION'],
  ['NETWORK_EMERGENCE', 'RESEARCH_MOMENTUM'],
  ['WORKFORCE_PRESSURE', 'INDUSTRY_INFLUENCE'],
];

function categoriesAreAffine(a: FindingCategory, b: FindingCategory): boolean {
  if (a === b) return true;
  return AFFINITY_GROUPS.some(group => group.includes(a) && group.includes(b));
}

// ── Severity escalation ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

const RANK_TO_SEVERITY: FindingSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function escalateSeverity(current: FindingSeverity, incoming: FindingSeverity): FindingSeverity {
  const max = Math.max(SEVERITY_RANK[current], SEVERITY_RANK[incoming]);
  return RANK_TO_SEVERITY[max] ?? current;
}

// ── Stage progression ──────────────────────────────────────────────────────────

function computeStage(eventCount: number, ageMs: number): StorylineStage {
  if (eventCount <= 1) return 'EMERGING';
  if (eventCount <= 3 && ageMs < 48 * 60 * 60 * 1000) return 'DEVELOPING';
  if (eventCount >= 4 || ageMs >= 7 * 24 * 60 * 60 * 1000) return 'MATURE';
  return 'DEVELOPING';
}

// ── Narrative generation ───────────────────────────────────────────────────────
//
// Deterministic narrative builder — no LLM. Composes from timeline events.
//

function buildNarrative(storyline: Storyline): string {
  const events = storyline.timeline;
  if (events.length === 0) return 'No events recorded.';

  const npiLabel = storyline.primaryNpi ? `NPI ${storyline.primaryNpi}` : `${storyline.npis.length} provider(s)`;
  const first = events[0]!;
  const latest = events[events.length - 1]!;
  const ageMs = new Date(latest.timestamp).getTime() - new Date(first.timestamp).getTime();
  const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));

  let narrative = '';

  switch (storyline.type) {
    case 'TRUST_RISK':
      narrative = `${npiLabel} has shown trust degradation`;
      if (ageDays > 0) narrative += ` over ${ageDays} day(s)`;
      narrative += `. ${events.length} related signal(s) detected: `;
      narrative += events.slice(-3).map(e => e.title).join(' → ');
      narrative += '.';
      if (storyline.severity === 'CRITICAL') {
        narrative += ' Immediate review recommended — trust band may be capped.';
      }
      break;

    case 'FRESHNESS_DEGRADATION':
      narrative = `Verification data for ${npiLabel} is aging. `;
      narrative += `${events.length} freshness signal(s) over `;
      narrative += ageDays > 0 ? `${ageDays} day(s). ` : 'the current period. ';
      narrative += 'Proactive re-verification can prevent trust score decline.';
      break;

    case 'NETWORK_EMERGENCE':
      narrative = `${npiLabel} is gaining influence in the trust graph. `;
      narrative += `${events.length} network change(s) detected. `;
      narrative += 'New institutional connections or verification relationships are forming.';
      break;

    case 'RISING_INVESTIGATOR':
      narrative = `Research momentum detected for ${npiLabel}. `;
      narrative += `${events.length} academic/publication signal(s). `;
      narrative += 'Monitor for trust score impact from new research affiliations.';
      break;

    case 'COMPLIANCE_ARC':
      narrative = `Compliance signals detected for ${npiLabel}. `;
      narrative += `${events.length} event(s) including `;
      narrative += events.map(e => e.category).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      narrative += '. Review exclusion and sanctions status.';
      break;

    default:
      narrative = `${events.length} related signal(s) for ${npiLabel}: `;
      narrative += events.slice(-3).map(e => e.title).join('; ');
      narrative += '.';
  }

  return narrative;
}

// ── Score computation ──────────────────────────────────────────────────────────

function computeStorylineScore(storyline: Storyline): number {
  const severityBase = SEVERITY_RANK[storyline.severity] * 20; // 0–80
  const eventBonus = Math.min(storyline.timeline.length * 3, 15);
  const recencyMs = Date.now() - new Date(storyline.updatedAt).getTime();
  const recencyPenalty = Math.min(Math.floor(recencyMs / (24 * 60 * 60 * 1000)) * 2, 20);

  return Math.min(Math.max(severityBase + eventBonus - recencyPenalty, 0), 100);
}

// ── Core operations ────────────────────────────────────────────────────────────

/**
 * Find an existing storyline that this finding should extend.
 */
function findMatchingStoryline(finding: Finding): Storyline | null {
  const storyType = CATEGORY_TO_STORYLINE[finding.category];
  if (!storyType) return null;

  for (const storyline of storylines) {
    if (storyline.status !== 'ACTIVE') continue;

    // Must share at least one NPI
    const sharedNpis = finding.npis.filter(n => storyline.npis.includes(n));
    if (sharedNpis.length === 0) continue;

    // Must be affine category or same storyline type
    const existingCategories = storyline.timeline.map(e => e.category);
    const isAffine = existingCategories.some(c => categoriesAreAffine(c, finding.category));
    if (!isAffine && CATEGORY_TO_STORYLINE[finding.category] !== storyline.type) continue;

    // Must not be too old (storylines older than 30 days start fresh)
    const ageMs = Date.now() - new Date(storyline.createdAt).getTime();
    if (ageMs > 30 * 24 * 60 * 60 * 1000) continue;

    // Must not already contain this finding
    if (storyline.findingIds.includes(finding.id)) continue;

    return storyline;
  }

  return null;
}

/**
 * Ingest a finding into the storyline layer.
 * Either extends an existing storyline or creates a new one.
 */
export function ingestFinding(finding: Finding): Storyline {
  const existing = findMatchingStoryline(finding);

  if (existing) {
    return extendStoryline(existing, finding);
  }

  return createStoryline(finding);
}

function createStoryline(finding: Finding): Storyline {
  const type = CATEGORY_TO_STORYLINE[finding.category] ?? 'TRUST_RISK';

  const storyline: Storyline = {
    id: makeStorylineId(),
    type,
    stage: 'EMERGING',
    title: finding.title,
    narrative: '',
    npis: [...finding.npis],
    primaryNpi: finding.npis[0] ?? null,
    findingIds: [finding.id],
    timeline: [{
      findingId: finding.id,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      timestamp: finding.createdAt,
      score: finding.score,
    }],
    severity: finding.severity,
    score: 0,
    actions: buildStorylineActions(type, finding.npis),
    relatedStorylines: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    status: 'ACTIVE',
    feedbackCount: 0,
  };

  storyline.narrative = buildNarrative(storyline);
  storyline.score = computeStorylineScore(storyline);

  storylines.unshift(storyline);
  if (storylines.length > MAX_STORYLINES) storylines.length = MAX_STORYLINES;

  log('info', `[Storyline] Created: [${storyline.stage}] ${storyline.title} (type=${storyline.type})`);
  return storyline;
}

function extendStoryline(storyline: Storyline, finding: Finding): Storyline {
  // Add finding to timeline
  storyline.findingIds.push(finding.id);
  storyline.timeline.push({
    findingId: finding.id,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    timestamp: finding.createdAt,
    score: finding.score,
  });

  // Merge NPIs
  for (const npi of finding.npis) {
    if (!storyline.npis.includes(npi)) storyline.npis.push(npi);
  }

  // Escalate severity
  storyline.severity = escalateSeverity(storyline.severity, finding.severity);

  // Progress stage
  const ageMs = Date.now() - new Date(storyline.createdAt).getTime();
  storyline.stage = computeStage(storyline.timeline.length, ageMs);

  // Update title to reflect evolution
  if (storyline.timeline.length >= 3) {
    const categories = [...new Set(storyline.timeline.map(e => e.category))];
    const npiLabel = storyline.primaryNpi ? `NPI ${storyline.primaryNpi}` : `${storyline.npis.length} providers`;
    storyline.title = `${storyline.type.replace(/_/g, ' ')} storyline: ${npiLabel} (${categories.length} signal types, ${storyline.timeline.length} events)`;
  }

  // Rebuild narrative and score
  storyline.narrative = buildNarrative(storyline);
  storyline.score = computeStorylineScore(storyline);
  storyline.updatedAt = new Date().toISOString();
  storyline.actions = buildStorylineActions(storyline.type, storyline.npis);

  log('info', `[Storyline] Extended: ${storyline.id} → ${storyline.stage} (${storyline.timeline.length} events, score=${storyline.score})`);
  return storyline;
}

function buildStorylineActions(type: StorylineType, npis: string[]): StorylineAction[] {
  const primary = npis[0];
  const actions: StorylineAction[] = [];

  if (primary) {
    actions.push(
      { id: 'investigate', label: 'Open investigation', type: 'investigate', payload: { npi: primary } },
      { id: 'monitor', label: 'Add to watchlist', type: 'monitor', payload: { npis } },
    );
  }

  if (npis.length >= 2) {
    actions.push({ id: 'compare', label: 'Compare providers', type: 'compare', payload: { npis } });
  }

  if (type === 'TRUST_RISK' || type === 'COMPLIANCE_ARC') {
    actions.push({ id: 'verify', label: 'Re-verify sources', type: 'verify', payload: { npis } });
  }

  actions.push(
    { id: 'archive', label: 'Archive storyline', type: 'archive', payload: {} },
    { id: 'dismiss', label: 'Dismiss', type: 'dismiss', payload: {} },
  );

  return actions;
}

// ── Query API ──────────────────────────────────────────────────────────────────

export interface StorylineQuery {
  types?:     StorylineType[];
  stages?:    StorylineStage[];
  npis?:      string[];
  status?:    Storyline['status'][];
  minScore?:  number;
  limit?:     number;
}

export function queryStorylines(query: StorylineQuery = {}): Storyline[] {
  let results = [...storylines];

  if (query.types?.length) {
    results = results.filter(s => query.types!.includes(s.type));
  }
  if (query.stages?.length) {
    results = results.filter(s => query.stages!.includes(s.stage));
  }
  if (query.npis?.length) {
    const npiSet = new Set(query.npis);
    results = results.filter(s => s.npis.some(n => npiSet.has(n)));
  }
  if (query.status?.length) {
    results = results.filter(s => query.status!.includes(s.status));
  }
  if (query.minScore) {
    results = results.filter(s => s.score >= query.minScore!);
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return results.slice(0, query.limit ?? 30);
}

export function getStorylineById(id: string): Storyline | null {
  return storylines.find(s => s.id === id) ?? null;
}

export function getStorylinesForNpi(npi: string): Storyline[] {
  return queryStorylines({ npis: [npi], status: ['ACTIVE'] });
}

export function getStorylineStats(): {
  total: number;
  active: number;
  byStage: Record<string, number>;
  byType: Record<string, number>;
} {
  const active = storylines.filter(s => s.status === 'ACTIVE');
  const byStage: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const s of active) {
    byStage[s.stage] = (byStage[s.stage] ?? 0) + 1;
    byType[s.type] = (byType[s.type] ?? 0) + 1;
  }
  return { total: storylines.length, active: active.length, byStage, byType };
}

// ── Feedback ───────────────────────────────────────────────────────────────────

export type StorylineFeedback = 'acknowledge' | 'dismiss' | 'escalate' | 'archive' | 'save' | 'compare' | 'follow_up';

const storylineFeedbackLog: { storylineId: string; action: StorylineFeedback; timestamp: string }[] = [];

export function recordStorylineFeedback(
  storylineId: string,
  action: StorylineFeedback,
): Storyline | null {
  const storyline = getStorylineById(storylineId);
  if (!storyline) return null;

  storylineFeedbackLog.push({
    storylineId,
    action,
    timestamp: new Date().toISOString(),
  });

  storyline.feedbackCount++;

  switch (action) {
    case 'acknowledge':
      storyline.status = 'ACKNOWLEDGED';
      break;
    case 'dismiss':
      storyline.status = 'RESOLVED';
      storyline.resolvedAt = new Date().toISOString();
      break;
    case 'archive':
      storyline.status = 'ARCHIVED';
      break;
    case 'escalate':
      storyline.score = Math.min(storyline.score + 20, 100);
      storyline.severity = escalateSeverity(storyline.severity, 'HIGH');
      break;
    case 'save':
      storyline.status = 'ACKNOWLEDGED';
      break;
    case 'compare':
    case 'follow_up':
      // Navigation actions — no status change
      break;
  }

  log('info', `[Storyline] Feedback: ${action} on ${storylineId}`);
  return storyline;
}

// ── Batch ingest from findings feed ────────────────────────────────────────────

/**
 * Scan all active findings and cluster them into storylines.
 * Call periodically or after a batch of findings arrive.
 */
export function clusterFindings(): { created: number; extended: number } {
  const activeFindings = queryFindings({ status: ['ACTIVE'], limit: 100 });
  let created = 0;
  let extended = 0;

  for (const finding of activeFindings) {
    // Skip findings already in a storyline
    const alreadyClustered = storylines.some(s =>
      s.findingIds.includes(finding.id) && s.status === 'ACTIVE',
    );
    if (alreadyClustered) continue;

    const existing = findMatchingStoryline(finding);
    if (existing) {
      extendStoryline(existing, finding);
      extended++;
    } else {
      createStoryline(finding);
      created++;
    }
  }

  if (created > 0 || extended > 0) {
    log('info', `[Storyline] Clustering: ${created} created, ${extended} extended`);
  }

  return { created, extended };
}
