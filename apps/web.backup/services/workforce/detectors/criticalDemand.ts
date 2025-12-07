import { calculateCoverageGap, WorkforceDemand, WorkforceDemandUrgency } from '../models/WorkforceDemand.js';

export interface DemandFulfillmentSnapshot {
  demandId: string;
  filledHeadcount: number;
  deptId?: string;
  role?: string;
  updatedAt?: Date | string;
}

export interface CriticalDemandDetectorInput {
  demands: WorkforceDemand[];
  fulfillments: DemandFulfillmentSnapshot[];
  now?: Date;
  leadTimeMinutes?: number;
  capacityThreshold?: number;
  urgencyFloor?: WorkforceDemandUrgency;
}

export interface CriticalDemandAlert {
  demandId: string;
  deptId: string;
  role: string;
  urgency: WorkforceDemandUrgency;
  shortage: number;
  coverageRatio: number;
  reason: 'UNFILLED_SHIFT' | 'SPECIALTY_BELOW_CAPACITY';
  severity: 'WARN' | 'CRITICAL';
  shiftTime: WorkforceDemand['shiftTime'];
}

export function detectCriticalDemand({
  demands,
  fulfillments,
  now = new Date(),
  leadTimeMinutes = 360,
  capacityThreshold = 0.8,
  urgencyFloor = WorkforceDemandUrgency.ROUTINE,
}: CriticalDemandDetectorInput): CriticalDemandAlert[] {
  const alerts: CriticalDemandAlert[] = [];
  const fulfillmentMap = new Map<string, DemandFulfillmentSnapshot>();
  fulfillments.forEach((snapshot) => {
    fulfillmentMap.set(snapshot.demandId, snapshot);
  });

  const aggregateBySpecialty = new Map<
    string,
    {
      deptId: string;
      role: string;
      required: number;
      filled: number;
      earliestShift: WorkforceDemand['shiftTime'];
      urgency: WorkforceDemandUrgency;
      demandId: string;
    }
  >();

  demands.forEach((demand) => {
    const fulfillment = demand.id ? fulfillmentMap.get(demand.id) : undefined;
    const filled = fulfillment?.filledHeadcount ?? demand.fulfilledHeadcount;
    const coverage = calculateCoverageGap(demand, filled);
    const minutesUntilShift = minutesBetween(now, demand.shiftTime.start);

    const aggregateKey = `${demand.deptId}::${demand.role}`;
    const aggregate = aggregateBySpecialty.get(aggregateKey) ?? {
      deptId: demand.deptId,
      role: demand.role,
      required: 0,
      filled: 0,
      earliestShift: demand.shiftTime,
      urgency: demand.urgency,
      demandId: demand.id ?? aggregateKey,
    };
    aggregate.required += demand.requiredHeadcount;
    aggregate.filled += filled;
    if (demand.shiftTime.start < aggregate.earliestShift.start) {
      aggregate.earliestShift = demand.shiftTime;
    }
    if (priorityRank(demand.urgency) > priorityRank(aggregate.urgency)) {
      aggregate.urgency = demand.urgency;
      aggregate.demandId = demand.id ?? aggregateKey;
    }
    aggregateBySpecialty.set(aggregateKey, aggregate);

    if (coverage.deficit > 0 && minutesUntilShift <= leadTimeMinutes && meetsUrgencyFloor(demand.urgency, urgencyFloor)) {
      alerts.push({
        demandId: demand.id ?? aggregateKey,
        deptId: demand.deptId,
        role: demand.role,
        urgency: demand.urgency,
        shortage: coverage.deficit,
        coverageRatio: coverage.coverageRatio,
        reason: 'UNFILLED_SHIFT',
        severity: coverage.status === 'CRITICAL' ? 'CRITICAL' : 'WARN',
        shiftTime: demand.shiftTime,
      });
    }
  });

  aggregateBySpecialty.forEach((aggregate, key) => {
    const coverageRatio = aggregate.required === 0 ? 1 : aggregate.filled / aggregate.required;
    if (coverageRatio >= capacityThreshold) {
      return;
    }
    alerts.push({
      demandId: aggregate.demandId,
      deptId: aggregate.deptId,
      role: aggregate.role,
      urgency: aggregate.urgency,
      shortage: Math.max(aggregate.required - aggregate.filled, 0),
      coverageRatio,
      reason: 'SPECIALTY_BELOW_CAPACITY',
      severity: coverageRatio < capacityThreshold / 2 ? 'CRITICAL' : 'WARN',
      shiftTime: aggregate.earliestShift,
    });
  });

  return alerts;
}

function minutesBetween(a: Date, b: Date | string): number {
  const end = b instanceof Date ? b : new Date(b);
  return Math.round((end.getTime() - a.getTime()) / 60000);
}

function meetsUrgencyFloor(value: WorkforceDemandUrgency, floor: WorkforceDemandUrgency): boolean {
  return priorityRank(value) >= priorityRank(floor);
}

function priorityRank(urgency: WorkforceDemandUrgency): number {
  switch (urgency) {
    case WorkforceDemandUrgency.CRITICAL:
      return 4;
    case WorkforceDemandUrgency.PRIORITY:
      return 3;
    case WorkforceDemandUrgency.ROUTINE:
      return 2;
    case WorkforceDemandUrgency.FLEXIBLE:
    default:
      return 1;
  }
}


