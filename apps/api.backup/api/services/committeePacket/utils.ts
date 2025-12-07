import { EvidencePoint, RiskTier, SectionNarrative, SeverityLevel } from './narrativeTypes';

export const DEFAULT_HIGHLIGHT_LIMIT = 4;

const severityRank: Record<SeverityLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityWeight(level: SeverityLevel = 'info'): number {
  return severityRank[level] ?? severityRank.info;
}

export function compareBySeverity(a: SeverityLevel, b: SeverityLevel): number {
  return severityWeight(b) - severityWeight(a);
}

export function formatDate(value?: string | Date | null, fallback = 'n/a'): string {
  if (!value) return fallback;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString().split('T')[0];
}

export function inferRiskTier(score?: number): RiskTier {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'low';
  }
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

export function clampScore(score: number, min = 0, max = 100): number {
  if (Number.isNaN(score)) return min;
  return Math.max(min, Math.min(max, score));
}

export function delta(current?: number, previous?: number): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number') {
    return null;
  }
  return Number((current - previous).toFixed(2));
}

export function limitList<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) return items;
  return items.slice(0, limit);
}

export function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    if (item && !seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

export function summarizeEvidence(evidence: EvidencePoint[], limit: number): EvidencePoint[] {
  return limitList(
    [...evidence].sort((a, b) => compareBySeverity(a.severity, b.severity)),
    limit
  );
}

export function emptySection(section: SectionNarrative['section']): SectionNarrative {
  return {
    section,
    summary: `No ${section} data provided`,
    highlights: [],
    concerns: [],
    evidence: [],
    confidence: 'low',
  };
}


