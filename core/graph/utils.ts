import { createHash } from 'crypto';

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function roundTo(value: number, precision = 6): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function sha256Hex(value: unknown): string {
  const payload = typeof value === 'string' || Buffer.isBuffer(value)
    ? value
    : stableStringify(value);
  return createHash('sha256').update(payload).digest('hex');
}

export function createDeterministicId(prefix: string, value: unknown): string {
  return `${prefix}_${sha256Hex(value).slice(0, 24)}`;
}

export function normalizeTimestamp(value: string): string {
  const normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return normalized.toISOString();
}

export function startOfUtcWeek(timestamp: string): string {
  const value = new Date(normalizeTimestamp(timestamp));
  const day = value.getUTCDay();
  const distanceFromMonday = (day + 6) % 7;
  value.setUTCDate(value.getUTCDate() - distanceFromMonday);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString();
}

export function endOfUtcWeek(timestamp: string): string {
  const value = new Date(startOfUtcWeek(timestamp));
  value.setUTCDate(value.getUTCDate() + 7);
  return value.toISOString();
}

export function hoursBetween(start: string, end: string): number {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 3_600_000);
}

export function daysBetween(start: string, end: string): number {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 86_400_000);
}

export function rankScores(entries: Array<{ nodeId: string; score: number }>): Array<{
  nodeId: string;
  score: number;
  rank: number;
  percentile: number;
}> {
  const sorted = [...entries]
    .map((entry) => ({
      nodeId: entry.nodeId,
      score: roundTo(entry.score),
    }))
    .sort((left, right) => right.score - left.score || left.nodeId.localeCompare(right.nodeId));

  const count = sorted.length;
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    percentile: count <= 1
      ? 1
      : roundTo(1 - (index / (count - 1))),
  }));
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
