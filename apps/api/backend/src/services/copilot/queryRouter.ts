/**
 * queryRouter.ts — Copilot Query Router
 *
 * Classifies natural language queries and routes them to the appropriate
 * VitalCV subsystem:
 *
 *   LOOKUP       → identity layer (NPI lookup, profile fetch)
 *   SEARCH       → search index (BM25 keyword, multi-type)
 *   GRAPH        → graph engine (traversal, neighbors, paths)
 *   TRUST        → trust score engine (score, freshness, divergence)
 *   INSIGHT      → intelligence engine (insights, anomalies, trends)
 *   MONITOR      → watchtower (alerts, monitoring status)
 *   COMPARE      → multi-NPI comparison
 *   EXPLAIN      → trust explanation / methodology
 *
 * Classification is deterministic (keyword + pattern matching).
 * No LLM required for routing — the Copilot orchestrator formats responses.
 */

import { log } from '../../obs/logger';

export type QueryIntent =
  | 'LOOKUP'    // "Who is NPI 1234567890?" / "Look up Dr. Smith"
  | 'SEARCH'    // "Find cardiologists in California"
  | 'GRAPH'     // "Show connections for..." / "Who is linked to..."
  | 'TRUST'     // "What's the trust score for..." / "How trusted is..."
  | 'INSIGHT'   // "Show me declining trust" / "Research clusters"
  | 'MONITOR'   // "Any alerts?" / "Stale data?" / "Exclusion status?"
  | 'COMPARE'   // "Compare these two NPIs" / "Which is more trusted?"
  | 'EXPLAIN'   // "How is trust calculated?" / "What is L3?"
  | 'INGEST'    // "Refresh data for..." / "Re-verify..."
  | 'UNKNOWN';  // Fallback

export interface ClassifiedQuery {
  intent:      QueryIntent;
  confidence:  number;       // 0.0–1.0
  npis:        string[];     // Extracted NPI numbers
  names:       string[];     // Extracted proper names
  keywords:    string[];     // Significant search terms
  filters:     Record<string, string>;  // Extracted filters (state, specialty, etc.)
  rawQuery:    string;
  explanation: string;       // Why this classification
}

// ── NPI extraction ─────────────────────────────────────────────────────────────

const NPI_PATTERN = /\b(\d{10})\b/g;

function extractNpis(query: string): string[] {
  const matches = query.match(NPI_PATTERN) ?? [];
  return [...new Set(matches)];
}

// ── Name extraction (simple heuristic) ─────────────────────────────────────────

function extractNames(query: string): string[] {
  // Match "Dr. Last", "Dr Last", "FirstName LastName" patterns
  const patterns = [
    /\bDr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
  ];
  const names = new Set<string>();
  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(query)) !== null) {
      const name = match[1]?.trim();
      if (name && !STOP_NAMES.has(name.toLowerCase())) {
        names.add(name);
      }
    }
  }
  return [...names];
}

const STOP_NAMES = new Set([
  'trust score', 'trust band', 'vital cv', 'vitalcv', 'graph engine',
  'open payments', 'clinical trials', 'board certification',
  'medical license', 'state board',
]);

// ── Filter extraction ──────────────────────────────────────────────────────────

function extractFilters(query: string): Record<string, string> {
  const filters: Record<string, string> = {};
  const lower = query.toLowerCase();

  // State
  const stateMatch = lower.match(/\bin\s+(california|texas|new york|florida|illinois|ohio|pennsylvania|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming|dc|district of columbia)\b/);
  if (stateMatch) filters['state'] = stateMatch[1]!;

  // Specialty
  const specMatch = lower.match(/\b(cardiolog|dermatolog|neurolog|oncolog|orthoped|pediatric|psychiatr|radiolog|surgeon|internal medicine|family medicine|emergency medicine|anesthesiolog|patholog|ophthalmolog|urolog|obstetr|gynecolog|pulmonolog|gastroenterolog|nephrol|endocrinolog|rheumatolog|infectious disease|geriatr|hematolog)/);
  if (specMatch) filters['specialty'] = specMatch[1]!;

  // Trust band
  const bandMatch = lower.match(/\b(l[0-3]|verified|credentialed|partial|unverified)\b/);
  if (bandMatch) filters['band'] = bandMatch[1]!.toUpperCase();

  return filters;
}

// ── Intent classification ──────────────────────────────────────────────────────

interface IntentSignal {
  intent:    QueryIntent;
  weight:    number;
  reason:    string;
}

function classifyIntent(query: string): ClassifiedQuery {
  const lower = query.toLowerCase().trim();
  const npis = extractNpis(query);
  const names = extractNames(query);
  const filters = extractFilters(query);

  const signals: IntentSignal[] = [];

  // ── LOOKUP signals ──────────────────────────────────────────────────────
  if (npis.length === 1) {
    signals.push({ intent: 'LOOKUP', weight: 0.6, reason: 'Single NPI detected' });
  }
  if (/\b(who is|look up|find npi|provider profile|show me|tell me about)\b/.test(lower)) {
    signals.push({ intent: 'LOOKUP', weight: 0.4, reason: 'Lookup keyword' });
  }
  if (names.length > 0 && npis.length === 0) {
    signals.push({ intent: 'LOOKUP', weight: 0.3, reason: 'Name detected without NPI' });
  }

  // ── SEARCH signals ──────────────────────────────────────────────────────
  if (/\b(find|search|list|show all|filter|browse)\b/.test(lower) && npis.length === 0) {
    signals.push({ intent: 'SEARCH', weight: 0.5, reason: 'Search keyword' });
  }
  if (filters['specialty'] || filters['state']) {
    signals.push({ intent: 'SEARCH', weight: 0.4, reason: 'Specialty or state filter' });
  }
  if (/\b(providers?|clinicians?|doctors?|physicians?)\b/.test(lower) && npis.length === 0) {
    signals.push({ intent: 'SEARCH', weight: 0.3, reason: 'Provider plural — likely search' });
  }

  // ── GRAPH signals ───────────────────────────────────────────────────────
  if (/\b(connect|linked|network|graph|relationship|neighbor|adjacent|path|traverse)\b/.test(lower)) {
    signals.push({ intent: 'GRAPH', weight: 0.6, reason: 'Graph keyword' });
  }
  if (/\b(affiliated|works at|trained at|published with)\b/.test(lower)) {
    signals.push({ intent: 'GRAPH', weight: 0.4, reason: 'Relationship keyword' });
  }

  // ── TRUST signals ───────────────────────────────────────────────────────
  if (/\b(trust score|trust band|trust level|how trusted|trust rating|score)\b/.test(lower)) {
    signals.push({ intent: 'TRUST', weight: 0.7, reason: 'Trust score keyword' });
  }
  if (/\b(exclusion|sanction|oig|leie|sam\.gov)\b/.test(lower)) {
    signals.push({ intent: 'TRUST', weight: 0.5, reason: 'Exclusion/sanction keyword' });
  }
  if (/\b(licensure|license status|board cert|enrollment)\b/.test(lower)) {
    signals.push({ intent: 'TRUST', weight: 0.4, reason: 'Credential verification keyword' });
  }

  // ── INSIGHT signals ─────────────────────────────────────────────────────
  if (/\b(insight|trend|declining|improving|cluster|research|pattern|anomal)\b/.test(lower)) {
    signals.push({ intent: 'INSIGHT', weight: 0.6, reason: 'Insight keyword' });
  }
  if (/\b(high influence|hub|investigator|rare specialty)\b/.test(lower)) {
    signals.push({ intent: 'INSIGHT', weight: 0.5, reason: 'Specific insight type' });
  }

  // ── MONITOR signals ─────────────────────────────────────────────────────
  if (/\b(alert|monitor|stale|expired|expiring|watchlist|watchtower|freshness)\b/.test(lower)) {
    signals.push({ intent: 'MONITOR', weight: 0.6, reason: 'Monitoring keyword' });
  }
  if (/\b(any (alerts|issues|problems)|what.s wrong|health check)\b/.test(lower)) {
    signals.push({ intent: 'MONITOR', weight: 0.5, reason: 'Status check pattern' });
  }

  // ── COMPARE signals ─────────────────────────────────────────────────────
  if (npis.length >= 2) {
    signals.push({ intent: 'COMPARE', weight: 0.7, reason: 'Multiple NPIs detected' });
  }
  if (/\b(compare|versus|vs\.?|difference|which.*better|which.*more)\b/.test(lower)) {
    signals.push({ intent: 'COMPARE', weight: 0.5, reason: 'Comparison keyword' });
  }

  // ── EXPLAIN signals ─────────────────────────────────────────────────────
  if (/\b(how (is|does|are)|what (is|does|are)|explain|methodology|why|meaning)\b/.test(lower)) {
    signals.push({ intent: 'EXPLAIN', weight: 0.4, reason: 'Explanation pattern' });
  }
  if (/\b(what.s (l[0-3]|trust band|trust score|verification freshness|divergence))\b/.test(lower)) {
    signals.push({ intent: 'EXPLAIN', weight: 0.7, reason: 'Methodology question' });
  }

  // ── INGEST signals ──────────────────────────────────────────────────────
  if (/\b(refresh|re-?verify|ingest|update data|re-?check|re-?scan)\b/.test(lower)) {
    signals.push({ intent: 'INGEST', weight: 0.6, reason: 'Data refresh keyword' });
  }

  // ── Resolve winner ──────────────────────────────────────────────────────
  const intentScores = new Map<QueryIntent, number>();
  for (const signal of signals) {
    intentScores.set(signal.intent, (intentScores.get(signal.intent) ?? 0) + signal.weight);
  }

  let bestIntent: QueryIntent = 'UNKNOWN';
  let bestScore = 0;
  for (const [intent, score] of intentScores) {
    if (score > bestScore) {
      bestIntent = intent;
      bestScore = score;
    }
  }

  // Normalize confidence
  const totalWeight = [...intentScores.values()].reduce((a, b) => a + b, 0);
  const confidence = totalWeight > 0
    ? Math.min(1, Math.round((bestScore / Math.max(totalWeight, 1)) * 100) / 100)
    : 0;

  const winningSignals = signals
    .filter(s => s.intent === bestIntent)
    .map(s => s.reason);

  // Extract significant keywords (remove stopwords)
  const keywords = lower
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !QUERY_STOPWORDS.has(w));

  return {
    intent:      bestIntent,
    confidence,
    npis,
    names,
    keywords,
    filters,
    rawQuery:    query,
    explanation: winningSignals.length > 0
      ? `Intent: ${bestIntent} (${Math.round(confidence * 100)}%). Signals: ${winningSignals.join(', ')}.`
      : `Could not classify query with confidence.`,
  };
}

const QUERY_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'ought',
  'for', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'with', 'from', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'about', 'that', 'this', 'these',
  'those', 'what', 'which', 'who', 'whom', 'whose', 'show', 'tell',
  'give', 'get', 'find', 'look', 'make', 'let', 'say',
]);

export { classifyIntent };
