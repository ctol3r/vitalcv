import { searchMcp } from "./store";
import { McpTool } from "./types";

// LRU cache for search results (Round 10: performance tuning)
const MAX = 200;
const LRU: Map<string, any> = new Map();
function getK(k: string) {
  const v = LRU.get(k);
  if (!v) return;
  LRU.delete(k);
  LRU.set(k, v);
  return v;
}
function setK(k: string, v: any) {
  if (LRU.size >= MAX) {
    const f = LRU.keys().next().value;
    LRU.delete(f);
  }
  LRU.set(k, v);
}

const TAU = Number(process.env.MCP_SELECT_TAU || 0.70); // Threshold τ for filtering results

/**
 * Smart librarian: retrieves and ranks MCPs for a given task
 * Applies scope-based boosting and reliability scoring
 */
export async function librarianSelect(
  query: string,
  scopeHints: string[] = [],
  topK = 5
): Promise<McpTool[]> {
  // Check LRU cache (Round 10)
  const cacheKey = `${query}|${(scopeHints || []).join(',')}`;
  const cached = getK(cacheKey);

  if (cached) {
    console.log(`[Librarian] LRU cache hit for: ${query}`);
    return cached;
  }

  // Retrieve best candidates for the current task
  const candidates = await searchMcp(query, scopeHints, topK * 2);

  // Rerank: favor user/domain scopes over global, and boost reliability
  // NEW: Domain-aware rerank - boost by domain hint in scopeHints like 'domain:physician'
  const domainHint = (scopeHints || []).find(s => s.startsWith('domain:'));

  const scored = candidates.map((c) => {
    const scope = (c.scope || "global") as string;

    // Scope bonus
    let scopeBonus = scope.startsWith("user:")
      ? 0.15
      : scope.startsWith("domain:")
      ? 0.05
      : 0;

    // Extra bonus if exact domain match
    if (domainHint && String(scope).includes(domainHint)) {
      scopeBonus += 0.15;
    }

    // Reliability bonus (scale from -0.1 to +0.1)
    const reliabilityBonus = (c.reliability_score - 0.5) * 0.2;

    // Usage bonus (logarithmic, max +0.05)
    const usageBonus = Math.min(0.05, Math.log10(c.usage_count + 1) * 0.02);

    const finalScore = (c.score || 0) + scopeBonus + reliabilityBonus + usageBonus;

    return { ...c, score: finalScore };
  });

  // Apply threshold τ filter (Round 10) and sort
  const filtered = scored
    .filter((r: any) => (r.score || 0) >= TAU)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, topK);

  // Cache the result in LRU (Round 10)
  setK(cacheKey, filtered);

  return filtered;
}

/**
 * Find similar MCPs (for deduplication or suggestions)
 */
export async function findSimilarMcps(
  name: string,
  description: string,
  threshold = 0.85
): Promise<McpTool[]> {
  const query = `${name} ${description}`;
  const candidates = await searchMcp(query, [], 10);

  return candidates.filter((c) => (c.score || 0) >= threshold);
}

/**
 * Get MCPs by tag
 */
export async function getMcpsByTag(tag: string): Promise<McpTool[]> {
  // Use semantic search with tag as query
  const results = await searchMcp(`tag:${tag}`, [], 20);

  // Filter to only those that actually have the tag
  return results.filter((mcp) => mcp.tags.includes(tag));
}

/**
 * Get MCPs by scope
 */
export async function getMcpsByScope(scope: string): Promise<McpTool[]> {
  return searchMcp("", [scope], 100);
}

