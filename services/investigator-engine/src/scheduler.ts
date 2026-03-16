import { DEFAULT_SCHEDULE_JOBS } from './sources';
import type { InvestigatorCadence, ScheduleDueInput, ScheduleJobDefinition } from './types';

const MINUTES_BY_CADENCE: Record<InvestigatorCadence, number> = {
  daily: 24 * 60,
  weekly: 7 * 24 * 60,
  monthly: 30 * 24 * 60,
  quarterly: 90 * 24 * 60,
  annual: 365 * 24 * 60,
};

function cadenceMinutes(cadence: InvestigatorCadence): number {
  return MINUTES_BY_CADENCE[cadence];
}

export function isScheduleDue(
  cadence: InvestigatorCadence,
  input: ScheduleDueInput,
): boolean {
  if (!input.lastRunAt) {
    return true;
  }

  const now = Date.parse(input.now ?? new Date().toISOString());
  const lastRunAt = Date.parse(input.lastRunAt);
  if (!Number.isFinite(now) || !Number.isFinite(lastRunAt)) {
    return true;
  }

  return (now - lastRunAt) >= cadenceMinutes(cadence) * 60_000;
}

export function nextRunAt(
  cadence: InvestigatorCadence,
  lastRunAt?: string | null,
): string | null {
  if (!lastRunAt) {
    return null;
  }

  const last = Date.parse(lastRunAt);
  if (!Number.isFinite(last)) {
    return null;
  }

  return new Date(last + cadenceMinutes(cadence) * 60_000).toISOString();
}

export function defaultScheduleJobs(): ScheduleJobDefinition[] {
  return [...DEFAULT_SCHEDULE_JOBS];
}
