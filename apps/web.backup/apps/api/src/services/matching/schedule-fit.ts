import { clamp01 } from './features';

export type CommuteMode = 'car' | 'transit' | 'flight';

export interface ShiftWindow {
  start: string; // HH:mm (24h)
  end: string; // HH:mm (24h)
  days: string[];
  timezone?: string;
  consecutiveNights?: number;
}

export interface ClinicianScheduleProfile {
  timezone?: string;
  availability: ShiftWindow[];
  maxCommuteMinutes?: number;
  travelRadiusMiles?: number;
  commuteMode?: CommuteMode;
  consecutiveNightShifts?: number;
}

export interface JobScheduleProfile {
  shift: ShiftWindow;
  onsiteRequirement?: boolean;
  shiftType?: 'day' | 'swing' | 'night';
  expectedConsecutiveNights?: number;
  location?: {
    latitude?: number;
    longitude?: number;
    state?: string;
  };
}

export interface TravelContext {
  distanceMiles?: number;
  mode?: CommuteMode;
}

export interface ScheduleFitInput {
  clinician: ClinicianScheduleProfile;
  job: JobScheduleProfile;
  travel?: TravelContext;
}

export interface ScheduleFitResult {
  scheduleFit: number;
  commuteMinutes: number;
  shiftOverlap: number;
  fatigueRisk: number;
  shiftNotes: string[];
}

const DEFAULT_SPEEDS: Record<CommuteMode, number> = {
  car: 35,
  transit: 22,
  flight: 420,
};

const DEFAULT_MAX_COMMUTE = 90;

export function calculateScheduleFit(input: ScheduleFitInput): ScheduleFitResult {
  const commuteMinutes = estimateCommuteMinutes(input);
  const overlap = computeShiftOverlap(input.clinician.availability, input.job.shift);
  const fatigueRisk = detectFatigueRisk(input);

  const commuteScore = clamp01(
    1 -
      Math.max(
        0,
        commuteMinutes - (input.clinician.maxCommuteMinutes ?? DEFAULT_MAX_COMMUTE),
      ) /
        180,
  );

  const shiftNotes: string[] = [];
  if (overlap < 0.5) {
    shiftNotes.push('Limited overlap with preferred shifts');
  }
  if (fatigueRisk > 0.6) {
    shiftNotes.push('Night-shift fatigue at risk threshold');
  }

  const scheduleFit = clamp01(
    commuteScore * 0.35 + overlap * 0.45 + (1 - fatigueRisk) * 0.2,
  );

  return {
    scheduleFit,
    commuteMinutes: Math.round(commuteMinutes),
    shiftOverlap: Number(overlap.toFixed(2)),
    fatigueRisk: Number(fatigueRisk.toFixed(2)),
    shiftNotes,
  };
}

function estimateCommuteMinutes(input: ScheduleFitInput): number {
  const travel = input.travel ?? {};
  const mode = travel.mode ?? input.clinician.commuteMode ?? 'car';
  const distance =
    travel.distanceMiles ??
    deriveDistanceFromRadius(input.clinician.travelRadiusMiles) ??
    35;
  const speed = DEFAULT_SPEEDS[mode] ?? DEFAULT_SPEEDS.car;

  const baseMinutes = (distance / speed) * 60;
  const congestion =
    input.job.shiftType === 'day'
      ? 1.25
      : input.job.shiftType === 'swing'
        ? 1.1
        : 0.9;

  return baseMinutes * congestion;
}

function deriveDistanceFromRadius(radius?: number): number | undefined {
  if (!radius || radius <= 0) {
    return undefined;
  }
  return Math.min(radius * 0.75, radius);
}

export function computeShiftOverlap(
  availability: ShiftWindow[],
  required: ShiftWindow,
): number {
  if (!availability.length) {
    return 0.4;
  }

  const requiredMinutes = windowMinutes(required);
  if (requiredMinutes === 0) {
    return 0.6;
  }

  let bestOverlap = 0;
  availability.forEach((window) => {
    const overlapMinutes = intersectWindows(window, required);
    const ratio = overlapMinutes / requiredMinutes;
    if (ratio > bestOverlap) {
      bestOverlap = ratio;
    }
  });

  return clamp01(bestOverlap);
}

function windowMinutes(window: ShiftWindow): number {
  const [startH, startM] = window.start.split(':').map((value) => Number(value) || 0);
  const [endH, endM] = window.end.split(':').map((value) => Number(value) || 0);
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

function intersectWindows(a: ShiftWindow, b: ShiftWindow): number {
  const overlapDays = a.days.some((day) => b.days.includes(day));
  if (!overlapDays) {
    return 0;
  }

  const [aStart, aEnd] = normalizeWindowRange(a);
  const [bStart, bEnd] = normalizeWindowRange(b);

  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);

  return Math.max(0, end - start);
}

function normalizeWindowRange(window: ShiftWindow): [number, number] {
  const [startH, startM] = window.start.split(':').map((value) => Number(value) || 0);
  const [endH, endM] = window.end.split(':').map((value) => Number(value) || 0);

  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return [startMinutes, endMinutes];
}

function detectFatigueRisk(input: ScheduleFitInput): number {
  const clinicianNights = input.clinician.consecutiveNightShifts ?? 0;
  const jobNights = input.job.expectedConsecutiveNights ?? 0;
  const totalNights = Math.max(clinicianNights, jobNights);

  if (totalNights <= 2) {
    return 0.15;
  }
  if (totalNights === 3) {
    return 0.35;
  }

  return clamp01(0.35 + (totalNights - 3) * 0.15);
}











