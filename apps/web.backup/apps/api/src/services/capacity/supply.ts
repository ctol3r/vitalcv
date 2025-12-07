import { addMonths } from 'date-fns';
import type { CapacityScenarioParams, CapacitySpecialtyPlan } from '@/src/capacity/scenario';

export interface SupplyProjectionPoint {
  monthIndex: number;
  date: string;
  supply: number;
  supplyWithVitalCv: number;
  attritionLoss: number;
  onboardingBacklog: number;
  onboardingBacklogVital: number;
}

export interface SpecialtySupplyCurve {
  specialty: string;
  region: string;
  points: SupplyProjectionPoint[];
  averageSupply: number;
  coverageRatio: number;
  attritionRate: number;
  onboardingLagMonths: number;
  vitalCvAccelerationWeeks: number;
  vitalCvUnlockedFte: number;
}

export interface SupplySimulationResult {
  startDate: string;
  horizonMonths: number;
  aggregate: SupplyProjectionPoint[];
  specialties: SpecialtySupplyCurve[];
  summary: {
    averageCoverage: number;
    averageAttrition: number;
    onboardingLagMonths: number;
    vitalCvAccelerationWeeks: number;
    vitalCvUnlockedFte: number;
  };
}

export function simulateSupplyCurves(params: CapacityScenarioParams): SupplySimulationResult {
  const startDate = sanitizeDate(params.startDate);
  const horizon = Math.max(3, Math.min(36, params.horizonMonths ?? 12));
  const specialties = params.specialties ?? [];
  const curves = specialties.map((plan) => simulateSpecialtySupply(startDate, horizon, plan));
  const aggregate = aggregateSupply(curves, startDate, horizon);

  const totalBaselineDemand = specialties.reduce((sum, plan) => sum + (plan.baselineDemand ?? 0), 0) || 1;
  const averageSupply = aggregate.reduce((sum, point) => sum + point.supply, 0) / aggregate.length;
  const coverage = averageSupply / totalBaselineDemand;

  const summary = {
    averageCoverage: round(coverage),
    averageAttrition: round(
      curves.reduce((sum, curve) => sum + curve.attritionRate, 0) / Math.max(1, curves.length),
    ),
    onboardingLagMonths: round(
      curves.reduce((sum, curve) => sum + curve.onboardingLagMonths, 0) / Math.max(1, curves.length),
    ),
    vitalCvAccelerationWeeks: round(
      curves.reduce((sum, curve) => sum + curve.vitalCvAccelerationWeeks, 0) / Math.max(1, curves.length),
    ),
    vitalCvUnlockedFte: round(
      curves.reduce((sum, curve) => sum + curve.vitalCvUnlockedFte, 0),
    ),
  };

  return {
    startDate: startDate.toISOString(),
    horizonMonths: horizon,
    aggregate,
    specialties: curves,
    summary,
  };
}

function simulateSpecialtySupply(
  startDate: Date,
  horizon: number,
  plan: CapacitySpecialtyPlan,
): SpecialtySupplyCurve {
  const baselineSupply = Math.max(4, plan.baselineSupply ?? plan.baselineDemand ?? 4);
  let baselineStaff = plan.currentStaff ?? baselineSupply;
  let vitalStaff = baselineStaff;
  let vitalPoolRemaining = Math.max(0, plan.vitalCvPool ?? 0);

  const attritionRate = clamp(plan.attritionRate ?? 0.01, 0, 0.08);
  const hiringVelocity = Math.max(0, plan.hiringVelocity ?? (plan.baselineDemand ?? 0) * 0.1);
  const onboardingLagMonths = Math.max(1, Math.round((plan.onboardingWeeks ?? 12) / 4));
  const vitalLagMonths = Math.max(
    1,
    Math.round((plan.vitalCvOnboardingWeeks ?? Math.max(4, (plan.onboardingWeeks ?? 12) * 0.6)) / 4),
  );

  const backlog: number[] = [];
  const backlogVital: number[] = [];
  const points: SupplyProjectionPoint[] = [];

  for (let monthIndex = 0; monthIndex < horizon; monthIndex += 1) {
    const date = addMonths(startDate, monthIndex).toISOString();

    const attritionLoss = baselineStaff * attritionRate;
    baselineStaff = Math.max(0, baselineStaff - attritionLoss);
    vitalStaff = Math.max(0, vitalStaff - attritionLoss);

    const completing = backlog[monthIndex] ?? 0;
    const completingVital = backlogVital[monthIndex] ?? 0;
    baselineStaff += completing;
    vitalStaff += completing + completingVital;

    const pipelineBoost = plan.pipeline?.active
      ? plan.pipeline.active / Math.max(1, onboardingLagMonths * 2)
      : 0;
    const totalNewHires = hiringVelocity + (plan.pipeline?.monthlyAdds ?? 0) + pipelineBoost;
    const backlogIndex = monthIndex + onboardingLagMonths;
    backlog[backlogIndex] = (backlog[backlogIndex] ?? 0) + totalNewHires;

    if (vitalPoolRemaining > 0) {
      const plannedWave = Math.max(0.5, (plan.vitalCvPool ?? 0) / Math.max(1, horizon * 0.75));
      const acceleratedAdds = hiringVelocity * 0.35 + plannedWave;
      const vitalBatch = Math.min(vitalPoolRemaining, acceleratedAdds);
      vitalPoolRemaining -= vitalBatch;
      const vitalIndex = monthIndex + vitalLagMonths;
      backlogVital[vitalIndex] = (backlogVital[vitalIndex] ?? 0) + vitalBatch;
    }

    points.push({
      monthIndex,
      date,
      supply: round(baselineStaff),
      supplyWithVitalCv: round(vitalStaff),
      attritionLoss: round(attritionLoss),
      onboardingBacklog: round(sumFuture(backlog, monthIndex)),
      onboardingBacklogVital: round(sumFuture(backlogVital, monthIndex)),
    });
  }

  const averageSupply = points.reduce((sum, point) => sum + point.supply, 0) / points.length;
  const coverageRatio = averageSupply / Math.max(1, plan.baselineDemand ?? 1);
  const lastPoint = points[points.length - 1];
  const vitalCvUnlockedFte = Math.max(0, (lastPoint?.supplyWithVitalCv ?? 0) - (lastPoint?.supply ?? 0));
  const vitalCvAccelerationWeeks = Math.max(0, onboardingLagMonths - vitalLagMonths) * 4;

  return {
    specialty: plan.specialty,
    region: plan.region ?? 'National',
    points,
    averageSupply: round(averageSupply),
    coverageRatio: round(coverageRatio),
    attritionRate,
    onboardingLagMonths,
    vitalCvAccelerationWeeks,
    vitalCvUnlockedFte: round(vitalCvUnlockedFte),
  };
}

function aggregateSupply(
  curves: SpecialtySupplyCurve[],
  startDate: Date,
  horizon: number,
): SupplyProjectionPoint[] {
  const aggregate: SupplyProjectionPoint[] = [];

  for (let monthIndex = 0; monthIndex < horizon; monthIndex += 1) {
    const date = addMonths(startDate, monthIndex).toISOString();

    const totals = curves.reduce(
      (acc, curve) => {
        const point = curve.points[monthIndex];
        if (!point) return acc;
        acc.supply += point.supply;
        acc.supplyWithVital += point.supplyWithVitalCv;
        acc.attritionLoss += point.attritionLoss;
        acc.backlog += point.onboardingBacklog;
        acc.backlogVital += point.onboardingBacklogVital;
        return acc;
      },
      { supply: 0, supplyWithVital: 0, attritionLoss: 0, backlog: 0, backlogVital: 0 },
    );

    aggregate.push({
      monthIndex,
      date,
      supply: round(totals.supply),
      supplyWithVitalCv: round(totals.supplyWithVital),
      attritionLoss: round(totals.attritionLoss),
      onboardingBacklog: round(totals.backlog),
      onboardingBacklogVital: round(totals.backlogVital),
    });
  }

  return aggregate;
}

function sanitizeDate(input?: string): Date {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function sumFuture(backlog: number[], monthIndex: number): number {
  let total = 0;
  for (let i = monthIndex + 1; i < backlog.length; i += 1) {
    total += backlog[i] ?? 0;
  }
  return total;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}


