import { addMonths } from 'date-fns';
import {
  CAPACITY_SCENARIO_TEMPLATES,
  type CapacityScenarioParams,
  type CapacitySpecialtyPlan,
  type SeasonalSpike,
} from '@/src/capacity/scenario';

export interface DemandProjectionPoint {
  monthIndex: number;
  date: string;
  demand: number;
  seasonalLift: number;
  expansionLift: number;
  retirementLift: number;
}

export interface SpecialtyDemandCurve {
  specialty: string;
  region: string;
  points: DemandProjectionPoint[];
  peakDemand: number;
  averageDemand: number;
}

export interface DemandSimulationResult {
  startDate: string;
  horizonMonths: number;
  aggregate: DemandProjectionPoint[];
  specialties: SpecialtyDemandCurve[];
}

const DEFAULT_SEASONAL_SPIKES: SeasonalSpike[] = [
  { label: 'Flu surge', month: 12, impact: 0.18, durationMonths: 3 },
  { label: 'RSV wave', month: 2, impact: 0.1, durationMonths: 2 },
];

export function simulateDemandCurves(params: CapacityScenarioParams): DemandSimulationResult {
  const startDate = sanitizeDate(params.startDate);
  const horizon = Math.max(3, Math.min(36, params.horizonMonths ?? 12));
  const specialties = params.specialties?.length ? params.specialties : CAPACITY_SCENARIO_TEMPLATES[0].params.specialties;

  const curves = specialties.map((plan) => simulateSpecialty(startDate, horizon, plan));
  const aggregate = aggregateDemand(curves, startDate, horizon);

  return {
    startDate: startDate.toISOString(),
    horizonMonths: horizon,
    specialties: curves,
    aggregate,
  };
}

function simulateSpecialty(
  startDate: Date,
  horizon: number,
  plan: CapacitySpecialtyPlan,
): SpecialtyDemandCurve {
  const baseline = Math.max(4, plan.baselineDemand);
  const spikes = plan.seasonalSpikes?.length ? plan.seasonalSpikes : DEFAULT_SEASONAL_SPIKES;
  const expansions = plan.expansions ?? [];
  const retirements = plan.retirements;

  const points: DemandProjectionPoint[] = [];

  for (let monthIndex = 0; monthIndex < horizon; monthIndex += 1) {
    const currentDate = addMonths(startDate, monthIndex);
    const seasonalLift = computeSeasonalLift(currentDate, baseline, spikes);
    const expansionLift = computeExpansionLift(monthIndex, expansions);
    const retirementLift = computeRetirementLift(monthIndex, baseline, retirements);

    const demand = Math.max(0, baseline + seasonalLift + expansionLift + retirementLift);
    points.push({
      monthIndex,
      date: currentDate.toISOString(),
      demand: round(demand),
      seasonalLift: round(seasonalLift),
      expansionLift: round(expansionLift),
      retirementLift: round(retirementLift),
    });
  }

  const peakDemand = points.reduce((max, point) => Math.max(max, point.demand), 0);
  const averageDemand = points.reduce((sum, point) => sum + point.demand, 0) / points.length;

  return {
    specialty: plan.specialty,
    region: plan.region ?? 'National',
    points,
    peakDemand: round(peakDemand),
    averageDemand: round(averageDemand),
  };
}

function aggregateDemand(
  curves: SpecialtyDemandCurve[],
  startDate: Date,
  horizon: number,
): DemandProjectionPoint[] {
  const aggregate: DemandProjectionPoint[] = [];

  for (let monthIndex = 0; monthIndex < horizon; monthIndex += 1) {
    const date = addMonths(startDate, monthIndex).toISOString();
    const accumulator = {
      demand: 0,
      seasonalLift: 0,
      expansionLift: 0,
      retirementLift: 0,
    };

    curves.forEach((curve) => {
      const point = curve.points[monthIndex];
      accumulator.demand += point?.demand ?? 0;
      accumulator.seasonalLift += point?.seasonalLift ?? 0;
      accumulator.expansionLift += point?.expansionLift ?? 0;
      accumulator.retirementLift += point?.retirementLift ?? 0;
    });

    aggregate.push({
      monthIndex,
      date,
      demand: round(accumulator.demand),
      seasonalLift: round(accumulator.seasonalLift),
      expansionLift: round(accumulator.expansionLift),
      retirementLift: round(accumulator.retirementLift),
    });
  }

  return aggregate;
}

function computeSeasonalLift(date: Date, baseline: number, spikes: SeasonalSpike[]): number {
  const month = date.getUTCMonth() + 1;
  let lift = 0;

  for (const spike of spikes) {
    const duration = spike.durationMonths ?? 2;
    const distance = seasonalDistance(month, spike.month);
    if (distance > duration) {
      continue;
    }
    const normalized = Math.exp(-1 * (distance * distance) / (2 * Math.pow(duration / 2, 2)));
    lift += baseline * spike.impact * normalized;
  }

  return lift;
}

function computeExpansionLift(monthIndex: number, expansions: CapacitySpecialtyPlan['expansions']): number {
  if (!expansions?.length) return 0;

  return expansions.reduce((sum, expansion) => {
    const ramp = expansion.rampMonths ?? 3;
    if (monthIndex < expansion.startMonth) return sum;
    const progress = clamp((monthIndex - expansion.startMonth + 1) / ramp, 0, 1);
    return sum + expansion.additionalDemand * progress;
  }, 0);
}

function computeRetirementLift(
  monthIndex: number,
  baseline: number,
  retirements?: CapacitySpecialtyPlan['retirements'],
): number {
  if (!retirements) return 0;

  const monthlyRate = retirements.annualRate / 12;
  let lift = baseline * monthlyRate;

  retirements.wavePeaks?.forEach((wave) => {
    const distance = Math.abs(monthIndex - wave.monthOffset);
    if (distance <= 1) {
      lift += baseline * monthlyRate * (wave.percentLift ?? 0);
    }
  });

  return lift;
}

function sanitizeDate(input?: string): Date {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function seasonalDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}


