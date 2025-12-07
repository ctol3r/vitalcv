import { DriftEvent, DriftEvidence, DriftDetectionStats, DriftSeverity, LocationSnapshot } from './types';

export interface DriftEventInit extends Omit<DriftEvent, 'id' | 'detectedAt'> {
  id?: string;
  detectedAt?: Date;
}

export function createDriftEvent(init: DriftEventInit): DriftEvent {
  return {
    ...init,
    id: init.id ?? `drift-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    detectedAt: init.detectedAt ?? new Date(),
  };
}

export function computeStats(events: DriftEvent[]): DriftDetectionStats {
  const breakdown: DriftDetectionStats['severityBreakdown'] = {};
  for (const event of events) {
    breakdown[event.severity] = (breakdown[event.severity] ?? 0) + 1;
  }
  return {
    totalSignals: events.length,
    severityBreakdown: breakdown,
  };
}

export function coerceDate(value?: Date | string | number | null): Date | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

export function daysBetween(a?: Date, b?: Date): number | undefined {
  if (!a || !b) return undefined;
  const diffMs = a.getTime() - b.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function normalizeText(value?: string | null): string {
  return value?.trim().toUpperCase() ?? '';
}

export function normalizeName(value: { first?: string; middle?: string; last?: string; suffix?: string; prefix?: string }): string {
  return [value.prefix, value.first, value.middle, value.last, value.suffix]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ');
}

export function formatLocation(location?: LocationSnapshot | null): string {
  if (!location) return '';
  const parts = [location.line1, location.line2, location.city, location.state, location.postalCode, location.country]
    .map((part) => normalizeText(part));
  return parts.filter(Boolean).join('|');
}

export function compareLocationSets(
  expected: LocationSnapshot[] = [],
  observed: LocationSnapshot[] = []
): { missing: string[]; unexpected: string[] } {
  const expectedSet = new Set(expected.map(formatLocation).filter(Boolean));
  const observedSet = new Set(observed.map(formatLocation).filter(Boolean));

  const missing = Array.from(expectedSet).filter((loc) => !observedSet.has(loc));
  const unexpected = Array.from(observedSet).filter((loc) => !expectedSet.has(loc));

  return { missing, unexpected };
}

export function buildEvidence(field: string, before?: unknown, after?: unknown, detail?: string): DriftEvidence {
  return {
    field,
    before,
    after,
    detail,
  };
}

export function maxSeverity(a: DriftSeverity, b: DriftSeverity): DriftSeverity {
  const order: DriftSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))] ?? b;
}
