/**
 * copilotEngine.ts — VitalCV Copilot Engine
 *
 * Conversational intelligence layer for provider identity.
 * Routes natural language queries to subsystems, composes responses,
 * and maintains conversation context.
 *
 * Architecture:
 *   User query → classifyIntent() → route to subsystem → format response
 *
 * No LLM dependency. The Copilot is a deterministic orchestrator that
 * composes responses from real subsystem data. A future LLM layer can
 * wrap this for more natural language, but the data path is always
 * through the engine.
 */

import { log } from '../../obs/logger';
import { classifyIntent, type ClassifiedQuery, type QueryIntent } from './queryRouter';
import { computeTrustScoreV1, type TrustScoreV1 } from '../trust/trustScoreV1';
import { computeTrustFreshness, type ClaimFreshnessReport } from '../identity/freshnessModel';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
import { querySearch, type SearchQuery, type SearchResponse } from '../search/searchIndex';
import {
  generateInsights,
  getCachedInsights,
  runAnomalyLoop,
  type Insight,
  type AnomalyReport,
} from '../intelligence/intelligenceEngine';
import { generateGraphInsights } from '../intelligence/graphInsightEngine';
import { investigateProvider, investigateNetwork, investigateComparison } from './investigationEngine';
import { getFindingsForNpi, queryFindings, getFeedStats } from '../investigators/framework';

// ── Response types ─────────────────────────────────────────────────────────────

export interface CopilotResponse {
  query:        ClassifiedQuery;
  intent:       QueryIntent;
  answer:       string;             // Natural language answer
  data:         CopilotData | null; // Structured data payload
  suggestions:  string[];           // Follow-up query suggestions
  sources:      string[];           // Data sources used
  timing:       number;             // Response time in ms
}

export type CopilotData =
  | { type: 'trust_score';   payload: TrustScoreV1 }
  | { type: 'freshness';     payload: ClaimFreshnessReport }
  | { type: 'divergence';    payload: DivergenceReport }
  | { type: 'search';        payload: SearchResponse }
  | { type: 'insights';      payload: Insight[] }
  | { type: 'anomaly';       payload: AnomalyReport }
  | { type: 'comparison';    payload: { scores: TrustScoreV1[] } }
  | { type: 'explanation';   payload: { topic: string; content: string } }
  | { type: 'text';          payload: { text: string } };

// ── Conversation context ───────────────────────────────────────────────────────

interface ConversationTurn {
  query:     string;
  intent:    QueryIntent;
  npis:      string[];
  timestamp: string;
}

const conversations = new Map<string, ConversationTurn[]>();
const MAX_CONTEXT_TURNS = 10;

function getContext(sessionId: string): ConversationTurn[] {
  return conversations.get(sessionId) ?? [];
}

function pushContext(sessionId: string, turn: ConversationTurn): void {
  const history = conversations.get(sessionId) ?? [];
  history.push(turn);
  if (history.length > MAX_CONTEXT_TURNS) history.shift();
  conversations.set(sessionId, history);
}

// Resolve NPI from context if not in current query
function resolveNpiFromContext(classified: ClassifiedQuery, sessionId: string): string | null {
  if (classified.npis.length > 0) return classified.npis[0]!;
  // Check previous turns for NPI context
  const history = getContext(sessionId);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.npis.length > 0) return history[i]!.npis[0]!;
  }
  return null;
}

// ── Intent handlers ────────────────────────────────────────────────────────────

async function handleLookup(classified: ClassifiedQuery, sessionId: string): Promise<CopilotResponse> {
  const npi = resolveNpiFromContext(classified, sessionId);
  if (!npi) {
    return makeResponse(classified, 'LOOKUP',
      'I need an NPI number to look up a provider. Try: "Look up NPI 1234567890"',
      null, ['Try: "Who is NPI 1234567890?"', 'Try: "Find cardiologists in California"'],
    );
  }

  const [score, npiFindings] = await Promise.all([
    computeTrustScoreV1(npi),
    Promise.resolve(getFindingsForNpi(npi)),
  ]);
  const bandEmoji = { L3: '🟢', L2: '🟡', L1: '🟠', L0: '🔴' }[score.band] ?? '⚪';

  const dimSummary = Object.entries(score.dimensions)
    .map(([key, dim]) => `${key}: ${dim.score}/${dim.max} (${dim.status})`)
    .join('\n  ');

  let answer = `${bandEmoji} **NPI ${npi}** — Trust Score: **${score.score}/100** (${score.bandLabel})\n\nConfidence: ${Math.round(score.confidence * 100)}%\n\nDimensions:\n  ${dimSummary}`;

  if (score.gaps.length > 0) {
    answer += `\n\nGaps:\n  ${score.gaps.map((g, i) => `${i + 1}. ${g}`).join('\n  ')}`;
  }

  // Surface active findings inline
  if (npiFindings.length > 0) {
    const severityEmoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', INFO: 'ℹ️' };
    answer += `\n\n**Active Findings (${npiFindings.length}):**`;
    for (const f of npiFindings.slice(0, 3)) {
      answer += `\n  ${severityEmoji[f.severity] ?? '•'} [${f.category}] ${f.title}`;
    }
    if (npiFindings.length > 3) {
      answer += `\n  ...and ${npiFindings.length - 3} more`;
    }
  }

  return makeResponse(classified, 'LOOKUP', answer,
    { type: 'trust_score', payload: score },
    [`What's the freshness status for NPI ${npi}?`, `Investigate NPI ${npi}`, `Show graph connections for NPI ${npi}`],
    ['TrustScoreV1', 'VerificationArtifact', 'InvestigatorFindings'],
  );
}

async function handleSearch(classified: ClassifiedQuery, _sessionId: string): Promise<CopilotResponse> {
  const searchQuery: SearchQuery = {
    q: classified.keywords.join(' ') || classified.rawQuery,
    limit: 10,
    aclLevel: 'PUBLIC',
  };

  const results = await querySearch(searchQuery);
  const count = results.results.length;

  if (count === 0) {
    return makeResponse(classified, 'SEARCH',
      `No results found for "${classified.rawQuery}". Try broader terms or check spelling.`,
      { type: 'search', payload: results },
      ['Try: "Find providers"', 'Try: "Show all clinicians"'],
    );
  }

  const summary = results.results.slice(0, 5)
    .map((r, i) => `${i + 1}. **${r.title}** (${r.type}) — ${r.snippet.slice(0, 80)}`)
    .join('\n');

  return makeResponse(classified, 'SEARCH',
    `Found **${count} result(s)** for "${classified.keywords.join(' ')}":\n\n${summary}${count > 5 ? `\n\n...and ${count - 5} more.` : ''}`,
    { type: 'search', payload: results },
    ['Narrow by specialty or state', 'Show trust scores for these results'],
    ['SearchIndex'],
  );
}

async function handleTrust(classified: ClassifiedQuery, sessionId: string): Promise<CopilotResponse> {
  const npi = resolveNpiFromContext(classified, sessionId);
  if (!npi) {
    return makeResponse(classified, 'TRUST',
      'I need an NPI to check trust status. Which provider are you asking about?',
      null, ['Provide an NPI: "Trust score for 1234567890"'],
    );
  }

  const [score, freshness, divergence] = await Promise.all([
    computeTrustScoreV1(npi),
    computeTrustFreshness(npi),
    detectDivergence(npi),
  ]);

  const bandEmoji = { L3: '🟢', L2: '🟡', L1: '🟠', L0: '🔴' }[score.band] ?? '⚪';
  const staleCount = freshness.staleDimensions.length;
  const conflictCount = divergence.conflicts.length;

  let answer = `${bandEmoji} **Trust Score for NPI ${npi}: ${score.score}/100** (${score.bandLabel})\n\n`;
  answer += `Confidence: ${Math.round(score.confidence * 100)}% | Freshness: ${Math.round(freshness.overallFreshness * 100)}%`;

  if (staleCount > 0) {
    answer += `\n\n⚠️ **${staleCount} stale verification(s):** ${freshness.staleDimensions.map(d => d.label).join(', ')}`;
  }
  if (conflictCount > 0) {
    answer += `\n\n🔴 **${conflictCount} cross-source conflict(s)** detected (penalty: -${divergence.totalPenalty} pts)`;
    for (const c of divergence.conflicts) {
      answer += `\n  • [${c.severity}] ${c.description}`;
    }
  }

  if (score.recommendations.length > 0) {
    answer += `\n\n**Recommendations:**\n${score.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`;
  }

  return makeResponse(classified, 'TRUST', answer,
    { type: 'trust_score', payload: score },
    [`Explain the trust methodology`, `Show freshness details for NPI ${npi}`, `Re-verify NPI ${npi}`],
    ['TrustScoreV1', 'FreshnessModel', 'DivergenceEngine'],
  );
}

async function handleInsight(classified: ClassifiedQuery, _sessionId: string): Promise<CopilotResponse> {
  const [systemInsights, graphInsights] = await Promise.all([
    classified.rawQuery.toLowerCase().includes('graph')
      ? Promise.resolve(getCachedInsights())
      : generateInsights({ limit: 10 }),
    generateGraphInsights(5),
  ]);

  const allInsights = [...systemInsights, ...graphInsights]
    .sort((a, b) => {
      const p = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return p[a.priority] - p[b.priority];
    })
    .slice(0, 10);

  if (allInsights.length === 0) {
    return makeResponse(classified, 'INSIGHT',
      'No insights available yet. The system needs more data and trust score history to detect patterns.',
      null, ['Run an intelligence cycle: POST /api/intelligence/cycle'],
    );
  }

  const priorityEmoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' };
  const summary = allInsights
    .map((ins, i) => `${i + 1}. ${priorityEmoji[ins.priority]} **${ins.title}**\n   ${ins.description}${ins.action ? `\n   → ${ins.action}` : ''}`)
    .join('\n\n');

  return makeResponse(classified, 'INSIGHT',
    `**${allInsights.length} insight(s) detected:**\n\n${summary}`,
    { type: 'insights', payload: allInsights },
    ['Show declining trust details', 'Show graph health', 'Run intelligence cycle'],
    ['IntelligenceEngine', 'GraphInsightEngine'],
  );
}

async function handleMonitor(classified: ClassifiedQuery, sessionId: string): Promise<CopilotResponse> {
  const npi = resolveNpiFromContext(classified, sessionId);
  if (!npi) {
    // System-wide monitoring status — combine insights + findings
    const insights = getCachedInsights();
    const feedStats = getFeedStats();
    const activeFindings = queryFindings({ status: ['ACTIVE'], limit: 5 });

    let answer = '**System Health Summary:**\n\n';

    // Findings summary
    if (feedStats.active > 0) {
      const severityEmoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', INFO: 'ℹ️' };
      answer += `**Active Findings:** ${feedStats.active}\n`;
      for (const [sev, count] of Object.entries(feedStats.bySeverity)) {
        if (count > 0) answer += `  ${severityEmoji[sev as keyof typeof severityEmoji] ?? '•'} ${sev}: ${count}\n`;
      }
      answer += '\n';
      if (activeFindings.length > 0) {
        answer += '**Top findings:**\n';
        for (const f of activeFindings) {
          answer += `  ${severityEmoji[f.severity] ?? '•'} ${f.title} (score: ${f.score})\n`;
        }
        answer += '\n';
      }
    } else {
      answer += '✅ No active investigator findings\n\n';
    }

    // Legacy insights
    const staleInsights = insights.filter(i => i.type === 'STALE_COVERAGE_GAP');
    const declining = insights.filter(i => i.type === 'DECLINING_TRUST');
    answer += `• ${staleInsights.length > 0 ? `⚠️ ${staleInsights[0]?.title}` : '✅ No stale coverage gaps'}\n`;
    answer += `• ${declining.length > 0 ? `🔴 ${declining.length} declining trust score(s)` : '✅ No declining trust scores'}\n`;

    return makeResponse(classified, 'MONITOR', answer,
      { type: 'insights', payload: insights },
      ['Show all findings', 'Run investigator scan', 'Check specific NPI'],
      ['IntelligenceEngine', 'InvestigatorFindings'],
    );
  }

  // NPI-specific monitoring
  const report = await runAnomalyLoop(npi);
  const healthEmoji = { HEALTHY: '✅', DEGRADED: '⚠️', CRITICAL: '🔴', UNKNOWN: '❓' }[report.overallHealth] ?? '❓';

  let answer = `${healthEmoji} **Monitoring Report for NPI ${npi}**: ${report.overallHealth}\n\n`;
  if (report.actionItems.length === 0) {
    answer += 'No issues detected. All verifications within SLA.';
  } else {
    answer += `**${report.actionItems.length} action item(s):**\n${report.actionItems.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}`;
  }

  return makeResponse(classified, 'MONITOR', answer,
    { type: 'anomaly', payload: report },
    [`Show trust score for NPI ${npi}`, `Re-verify NPI ${npi}`, `Show graph for NPI ${npi}`],
    ['DivergenceEngine', 'FreshnessModel', 'ChangeMonitor'],
  );
}

async function handleCompare(classified: ClassifiedQuery, _sessionId: string): Promise<CopilotResponse> {
  if (classified.npis.length < 2) {
    return makeResponse(classified, 'COMPARE',
      'I need at least two NPIs to compare. Example: "Compare 1234567890 and 0987654321"',
      null, ['Provide two NPIs to compare'],
    );
  }

  const scores = await Promise.all(
    classified.npis.slice(0, 5).map(npi => computeTrustScoreV1(npi)),
  );

  scores.sort((a, b) => b.score - a.score);
  const bandEmoji = { L3: '🟢', L2: '🟡', L1: '🟠', L0: '🔴' };

  const comparison = scores
    .map((s, i) => {
      const emoji = bandEmoji[s.band] ?? '⚪';
      return `${i + 1}. ${emoji} NPI ${s.npi}: **${s.score}/100** (${s.bandLabel}) — confidence ${Math.round(s.confidence * 100)}%`;
    })
    .join('\n');

  const best = scores[0]!;
  const worst = scores[scores.length - 1]!;
  const delta = best.score - worst.score;

  return makeResponse(classified, 'COMPARE',
    `**Trust Score Comparison** (${scores.length} providers):\n\n${comparison}\n\nSpread: ${delta} pts between highest and lowest.`,
    { type: 'comparison', payload: { scores } },
    scores.map(s => `Details for NPI ${s.npi}`),
    ['TrustScoreV1'],
  );
}

function handleExplain(classified: ClassifiedQuery, _sessionId: string): CopilotResponse {
  const lower = classified.rawQuery.toLowerCase();

  if (/trust score|how.*scored|methodology/.test(lower)) {
    return makeResponse(classified, 'EXPLAIN',
      `**Trust Score V1 Methodology**\n\nVitalCV computes a composite trust score (0–100) across 8 weighted dimensions:\n\n` +
      `• **Identity** (15 pts) — NPI confirmed via NPPES\n` +
      `• **Licensure** (25 pts) — Active state license verified\n` +
      `• **Exclusion** (20 pts) — OIG/LEIE/SAM.gov clear\n` +
      `• **Enrollment** (10 pts) — CMS Medicare/Medicaid active\n` +
      `• **Board Cert** (10 pts) — ABMS/AOA certification\n` +
      `• **Coverage** (10 pts) — Breadth of sources checked\n` +
      `• **Freshness** (7 pts) — Recency of verification\n` +
      `• **Academic** (3 pts) — Research/publication identity\n\n` +
      `Cross-source contradictions apply penalties: CRITICAL −15, MODERATE −7, MINOR −3.\n\n` +
      `Full methodology: GET /api/trust/methodology`,
      { type: 'explanation', payload: { topic: 'trust_score_methodology', content: 'Trust Score V1' } },
      ['What is L3?', 'What is verification freshness?', 'What is divergence detection?'],
    );
  }

  if (/l[0-3]|trust band|band/.test(lower)) {
    return makeResponse(classified, 'EXPLAIN',
      `**Trust Bands**\n\n` +
      `🟢 **L3 — VERIFIED** (≥80 pts): Exclusion clear, no critical contradictions\n` +
      `🟡 **L2 — CREDENTIALED** (≥60 pts): Exclusion not excluded\n` +
      `🟠 **L1 — PARTIAL** (≥40 pts): Some verification, gaps remain\n` +
      `🔴 **L0 — UNVERIFIED** (<40 pts): Insufficient verification data`,
      { type: 'explanation', payload: { topic: 'trust_bands', content: 'L0-L3 bands' } },
      ['How is trust score calculated?', 'What causes L0?'],
    );
  }

  if (/freshness|stale|aging|decay/.test(lower)) {
    return makeResponse(classified, 'EXPLAIN',
      `**Verification Freshness**\n\n` +
      `Each claim class has a freshness window:\n\n` +
      `• Exclusion/Sanctions: fresh <24h, stale >72h (CRITICAL)\n` +
      `• Licensure: fresh <7d, stale >30d (HIGH)\n` +
      `• NPI Identity: fresh <7d, stale >60d (HIGH)\n` +
      `• Enrollment: fresh <30d, stale >90d (MEDIUM)\n` +
      `• Board Cert: fresh <30d, stale >1y (MEDIUM)\n\n` +
      `Freshness decays linearly — no cliff-drops. Score impact is proportional to risk level.`,
      { type: 'explanation', payload: { topic: 'freshness', content: 'Verification freshness model' } },
      ['Check freshness for a specific NPI', 'Show stale providers'],
    );
  }

  if (/divergen|conflict|mismatch|contradic/.test(lower)) {
    return makeResponse(classified, 'EXPLAIN',
      `**Cross-Source Divergence Detection**\n\n` +
      `VitalCV detects when the same clinical fact has conflicting values across authoritative sources.\n\n` +
      `7 rules check for:\n` +
      `• Exclusion mismatch (OIG vs SAM.gov)\n` +
      `• License status contradiction (PECOS vs state board)\n` +
      `• Stale vs fresh exclusion conflict\n` +
      `• Enrollment vs affiliation mismatch\n` +
      `• Practice location differences\n` +
      `• Identity name mismatch\n` +
      `• Specialty discrepancies\n\n` +
      `Penalties: CRITICAL −15 pts, MODERATE −7 pts, MINOR −3 pts.`,
      { type: 'explanation', payload: { topic: 'divergence', content: 'Cross-source divergence' } },
      ['Check divergence for a specific NPI', 'Show providers with conflicts'],
    );
  }

  return makeResponse(classified, 'EXPLAIN',
    `I can explain:\n• Trust Score methodology\n• Trust bands (L0–L3)\n• Verification freshness\n• Cross-source divergence detection\n\nWhat would you like to know more about?`,
    null, ['How is trust score calculated?', 'What is L3?', 'What is freshness?', 'What is divergence?'],
  );
}

async function handleInvestigate(classified: ClassifiedQuery, sessionId: string): Promise<CopilotResponse> {
  const npi = resolveNpiFromContext(classified, sessionId);
  if (!npi) {
    return makeResponse(classified, 'INVESTIGATE',
      'I need an NPI to investigate. Example: "Investigate NPI 1234567890" or "Deep dive on Dr. Smith"',
      null, ['Try: "Investigate NPI 1234567890"', 'Try: "Full report on 0987654321"'],
    );
  }

  const lower = classified.rawQuery.toLowerCase();
  const isNetworkFocused = /\b(network|collaborat|connection|peer|institution|cluster)\b/.test(lower);
  const isComparison = classified.npis.length >= 2;

  if (isComparison) {
    const report = await investigateComparison(classified.npis);
    const rankSummary = report.comparison!.ranking
      .map((r, i) => `${i + 1}. NPI ${r.npi}: **${r.score}/100** (${r.band})`)
      .join('\n');

    let answer = `📊 **Provider Comparison** (${report.durationMs}ms)\n\n${rankSummary}`;

    if (report.comparison!.strengthDelta.length > 0) {
      const top = report.comparison!.strengthDelta[0]!;
      answer += `\n\n**Biggest differentiation:** ${top.dimension} (${top.spread} pt spread, led by NPI ${top.leader})`;
    }
    if (report.comparison!.commonGaps.length > 0) {
      answer += `\n\n**Shared gaps:** ${report.comparison!.commonGaps.join(', ')}`;
    }

    return makeResponse(classified, 'INVESTIGATE', answer,
      { type: 'text', payload: { text: JSON.stringify(report.comparison!.ranking) } },
      report.recommendations,
      ['TrustScoreV1', 'DivergenceEngine', 'FreshnessModel'],
    );
  }

  if (isNetworkFocused) {
    const report = await investigateNetwork(npi);
    const net = report.network!;
    let answer = `🔗 **Network Investigation for NPI ${npi}** (${report.durationMs}ms)\n\n`;
    answer += `**Network:** ${net.networkStats.totalNodes} nodes, ${net.networkStats.totalEdges} edges\n`;
    answer += `**Avg degree:** ${net.networkStats.avgDegree.toFixed(1)} | **Max degree:** ${net.networkStats.maxDegree}\n`;
    answer += `**Clinicians:** ${net.networkStats.clinicianCount} | **Institutions:** ${net.networkStats.institutionCount} | **Credentials:** ${net.networkStats.credentialCount}\n`;

    if (net.collaborators.length > 0) {
      const top5 = net.collaborators.slice(0, 5);
      answer += `\n**Top collaborators:**\n`;
      answer += top5.map((c, i) => `  ${i + 1}. ${c.label} (${c.type}, ${c.sharedEdges} shared edges, degree ${c.degree})`).join('\n');
    }

    if (net.institutions.length > 0) {
      answer += `\n\n**Institutional clusters:**\n`;
      answer += net.institutions.slice(0, 3).map(inst => `  • ${inst.name} (${inst.memberCount} linked providers)`).join('\n');
    }

    if (net.researchClusters.length > 0) {
      answer += `\n\n**Research clusters:** ${net.researchClusters.length} identified`;
    }

    return makeResponse(classified, 'INVESTIGATE', answer,
      { type: 'text', payload: { text: `Network: ${net.networkStats.totalNodes} nodes` } },
      [...report.recommendations, `Investigate provider NPI ${npi}`, `Compare peers of NPI ${npi}`],
      ['GraphEngine', 'QueryService'],
    );
  }

  // Full provider investigation
  const report = await investigateProvider(npi);
  const p = report.profile!;
  const bandEmoji = { L3: '🟢', L2: '🟡', L1: '🟠', L0: '🔴' }[p.trustScore.band] ?? '⚪';

  let answer = `🔍 **Investigation Report: NPI ${npi}** (${report.durationMs}ms)\n\n`;
  answer += `${bandEmoji} **Trust Score:** ${p.trustScore.score}/100 (${p.trustScore.bandLabel}) — confidence ${Math.round(p.trustScore.confidence * 100)}%\n\n`;

  // Freshness
  answer += `**Freshness:** ${Math.round(p.freshness.overallFreshness * 100)}%`;
  if (p.freshness.staleDimensions.length > 0) {
    answer += ` ⚠️ ${p.freshness.staleDimensions.length} stale`;
  }
  answer += '\n';

  // Divergence
  if (p.divergence.conflicts.length > 0) {
    answer += `**Conflicts:** ${p.divergence.conflicts.length} detected (penalty: −${p.divergence.totalPenalty})\n`;
    for (const c of p.divergence.conflicts.slice(0, 3)) {
      answer += `  • [${c.severity}] ${c.description}\n`;
    }
  } else {
    answer += `**Conflicts:** None ✅\n`;
  }

  // Anomaly
  const healthEmoji = { HEALTHY: '✅', DEGRADED: '⚠️', CRITICAL: '🔴', UNKNOWN: '❓' }[p.anomalyReport.overallHealth] ?? '❓';
  answer += `**Health:** ${healthEmoji} ${p.anomalyReport.overallHealth}\n`;

  // Network
  const net = report.network!;
  answer += `\n**Network:** ${net.networkStats.totalNodes} nodes, ${net.collaborators.length} collaborators`;
  if (net.institutions.length > 0) {
    answer += `, ${net.institutions.length} institutions`;
  }
  answer += '\n';

  // Artifacts
  answer += `**Artifacts:** ${p.artifactCount} verification records\n`;

  // Recommendations
  if (report.recommendations.length > 0) {
    answer += `\n**Recommendations:**\n${report.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`;
  }

  return makeResponse(classified, 'INVESTIGATE', answer,
    { type: 'trust_score', payload: p.trustScore },
    [
      `Show network for NPI ${npi}`,
      `Compare NPI ${npi} with peers`,
      `Explain the trust methodology`,
      `Show graph for NPI ${npi}`,
    ],
    ['TrustScoreV1', 'FreshnessModel', 'DivergenceEngine', 'GraphEngine', 'IntelligenceEngine'],
  );
}

async function handleIngest(classified: ClassifiedQuery, sessionId: string): Promise<CopilotResponse> {
  const npi = resolveNpiFromContext(classified, sessionId);
  if (!npi) {
    return makeResponse(classified, 'INGEST',
      'Which provider should I refresh? Provide an NPI.',
      null, ['Try: "Refresh data for NPI 1234567890"'],
    );
  }

  return makeResponse(classified, 'INGEST',
    `To refresh data for NPI ${npi}, use:\n\n` +
    `\`POST /api/intelligence/ingest/${npi}\`\n\n` +
    `This will run the full ingestion loop: ingest all sources → recompute trust score → detect divergence → emit events.\n\n` +
    `⚠️ This is a write operation — not triggered from Copilot queries directly. Use the API endpoint or the Intelligence dashboard.`,
    { type: 'text', payload: { text: `Ingest endpoint: POST /api/intelligence/ingest/${npi}` } },
    [`Show current trust score for NPI ${npi}`, `Check freshness for NPI ${npi}`],
    ['IdentityIngestionPipeline', 'TrustScoreV1'],
  );
}

// ── Response builder ───────────────────────────────────────────────────────────

function makeResponse(
  query:       ClassifiedQuery,
  intent:      QueryIntent,
  answer:      string,
  data:        CopilotData | null,
  suggestions: string[] = [],
  sources:     string[] = [],
  timing = 0,
): CopilotResponse {
  return { query, intent, answer, data, suggestions, sources, timing };
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function askCopilot(
  rawQuery: string,
  sessionId = 'default',
): Promise<CopilotResponse> {
  const startMs = Date.now();

  // Classify
  const classified = classifyIntent(rawQuery);

  log('info', `[Copilot] Query="${rawQuery}" → intent=${classified.intent} conf=${classified.confidence}`);

  // Push to conversation context
  pushContext(sessionId, {
    query:     rawQuery,
    intent:    classified.intent,
    npis:      classified.npis,
    timestamp: new Date().toISOString(),
  });

  // Route to handler
  let response: CopilotResponse;

  try {
    switch (classified.intent) {
      case 'LOOKUP':   response = await handleLookup(classified, sessionId); break;
      case 'SEARCH':   response = await handleSearch(classified, sessionId); break;
      case 'TRUST':    response = await handleTrust(classified, sessionId); break;
      case 'INSIGHT':  response = await handleInsight(classified, sessionId); break;
      case 'MONITOR':  response = await handleMonitor(classified, sessionId); break;
      case 'COMPARE':  response = await handleCompare(classified, sessionId); break;
      case 'EXPLAIN':  response = handleExplain(classified, sessionId); break;
      case 'INGEST':      response = await handleIngest(classified, sessionId); break;
      case 'INVESTIGATE': response = await handleInvestigate(classified, sessionId); break;
      case 'GRAPH':
        // Graph queries redirect to trust for now (graph explorer is visual)
        response = classified.npis.length > 0
          ? await handleLookup(classified, sessionId)
          : makeResponse(classified, 'GRAPH',
              'Graph exploration is best done visually at /graph. For NPI-specific connections, provide an NPI.',
              null, ['Open the graph explorer at /graph', 'Look up a specific NPI'],
            );
        break;
      default:
        response = makeResponse(classified, 'UNKNOWN',
          `I'm not sure what you're asking. I can help with:\n\n` +
          `• **Provider lookup** — "Who is NPI 1234567890?"\n` +
          `• **Trust scores** — "What's the trust score for NPI X?"\n` +
          `• **Search** — "Find cardiologists in California"\n` +
          `• **Insights** — "Show declining trust scores"\n` +
          `• **Monitoring** — "Any alerts?"\n` +
          `• **Compare** — "Compare NPI X and NPI Y"\n` +
          `• **Investigate** — "Investigate NPI X" / "Deep dive on provider"\n` +
          `• **Explain** — "How is trust calculated?"`,
          null,
          ['Who is NPI 1234567890?', 'Investigate NPI 1234567890', 'Show insights', 'How is trust calculated?'],
        );
    }
  } catch (err) {
    log('error', `[Copilot] Handler failed for intent=${classified.intent}: ${(err as Error)?.message}`);
    response = makeResponse(classified, classified.intent,
      `Something went wrong processing your request. Error: ${(err as Error)?.message ?? 'unknown'}`,
      null, ['Try again', 'Ask a different question'],
    );
  }

  response.timing = Date.now() - startMs;
  return response;
}

// ── Session management ─────────────────────────────────────────────────────────

export function clearCopilotSession(sessionId: string): void {
  conversations.delete(sessionId);
}

export function getCopilotSessionHistory(sessionId: string): ConversationTurn[] {
  return getContext(sessionId);
}
