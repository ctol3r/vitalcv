/**
 * B208A-QS-004: EnrollmentMicroTrendAnalyzer
 *
 * Detects rising payer denials, stalled PECOS changes, odd Medicaid shifts.
 */

import type {
  CreateQualityMicroSignalInput,
  QualityMicroSignalSeverity,
} from '../models/QualityMicroSignal.js';
import { createQualityMicroSignal } from '../models/QualityMicroSignal.js';

export interface PayerDenial {
  payerId: string;
  payerName: string;
  denialDate: Date;
  denialReason?: string;
  claimAmount?: number;
}

export interface PECOSChange {
  changeDate: Date;
  changeType: 'ENROLLMENT' | 'UPDATE' | 'DEACTIVATION' | 'REACTIVATION';
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  daysPending?: number;
}

export interface MedicaidEnrollment {
  state: string;
  enrollmentDate: Date;
  status: 'ENROLLED' | 'PENDING' | 'DEACTIVATED' | 'REJECTED';
  changeDate?: Date;
}

export interface EnrollmentMicroTrendConfig {
  denialWindowDays: number; // Days to look back for denial trends
  minDenialsForTrend: number; // Minimum denials to detect a trend
  denialIncreaseThreshold: number; // Percentage increase to trigger signal (e.g., 0.5 = 50%)
  pecosStallDays: number; // Days a PECOS change can be pending before it's considered stalled
  medicaidShiftThreshold: number; // Number of state changes to trigger signal
}

const DEFAULT_CONFIG: EnrollmentMicroTrendConfig = {
  denialWindowDays: 90, // Last 90 days
  minDenialsForTrend: 3, // Need at least 3 denials
  denialIncreaseThreshold: 0.5, // 50% increase
  pecosStallDays: 30, // 30 days pending = stalled
  medicaidShiftThreshold: 2, // 2 state changes = unusual
};

/**
 * Extract enrollment micro-trend signals
 */
export class EnrollmentMicroTrendAnalyzer {
  private config: EnrollmentMicroTrendConfig;

  constructor(config?: Partial<EnrollmentMicroTrendConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze payer denials for rising trends
   */
  analyzePayerDenials(
    clinicianId: string,
    denials: PayerDenial[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    if (denials.length < this.config.minDenialsForTrend) {
      return signals;
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.config.denialWindowDays * 24 * 60 * 60 * 1000);

    // Filter to recent denials
    const recentDenials = denials.filter((d) => d.denialDate >= cutoffDate);
    if (recentDenials.length < this.config.minDenialsForTrend) {
      return signals;
    }

    // Split into two halves to compare
    const sortedDenials = [...recentDenials].sort(
      (a, b) => a.denialDate.getTime() - b.denialDate.getTime()
    );
    const midpoint = Math.floor(sortedDenials.length / 2);
    const firstHalf = sortedDenials.slice(0, midpoint);
    const secondHalf = sortedDenials.slice(midpoint);

    const firstHalfRate = firstHalf.length / (this.config.denialWindowDays / 2);
    const secondHalfRate = secondHalf.length / (this.config.denialWindowDays / 2);

    // Check for increase
    if (secondHalfRate > 0 && firstHalfRate > 0) {
      const increase = (secondHalfRate - firstHalfRate) / firstHalfRate;
      if (increase > this.config.denialIncreaseThreshold) {
        const severity: QualityMicroSignalSeverity = increase > 1.0 ? 'MEDIUM' : 'LOW';

        // Group by payer
        const payerGroups = recentDenials.reduce((acc, d) => {
          acc[d.payerName] = (acc[d.payerName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        signals.push(
          createQualityMicroSignal({
            clinicianId,
            signalType: 'ENROLLMENT_DENIAL_MICROTREND',
            severity,
            timestamp: now,
            details: {
              summary: `Rising payer denial trend: ${secondHalf.length} denials in recent period vs ${firstHalf.length} in earlier period (${(increase * 100).toFixed(1)}% increase)`,
              metric: 'PAYER_DENIAL_RATE',
              observedValue: secondHalfRate,
              expectedValue: firstHalfRate,
              threshold: firstHalfRate * (1 + this.config.denialIncreaseThreshold),
              sampleSize: recentDenials.length,
              windowStart: sortedDenials[0].denialDate.toISOString(),
              windowEnd: sortedDenials[sortedDenials.length - 1].denialDate.toISOString(),
              evidence: [
                { label: 'Recent Denials', value: secondHalf.length },
                { label: 'Earlier Denials', value: firstHalf.length },
                { label: 'Increase %', value: increase * 100 },
              ],
              metadata: {
                payerGroups,
                increaseRate: increase,
              },
            },
            source: 'EnrollmentMicroTrendAnalyzer',
          })
        );
      }
    }

    return signals;
  }

  /**
   * Analyze PECOS changes for stalled updates
   */
  analyzePECOSStalls(
    clinicianId: string,
    changes: PECOSChange[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    const now = new Date();
    const stalledChanges = changes.filter((c) => {
      if (c.status !== 'PENDING') return false;
      const daysPending = c.daysPending ?? (now.getTime() - c.changeDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysPending > this.config.pecosStallDays;
    });

    if (stalledChanges.length > 0) {
      const longestStall = Math.max(
        ...stalledChanges.map((c) => {
          const daysPending = c.daysPending ?? (now.getTime() - c.changeDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysPending;
        })
      );

      const severity: QualityMicroSignalSeverity = longestStall > this.config.pecosStallDays * 2 ? 'MEDIUM' : 'LOW';

      signals.push(
        createQualityMicroSignal({
          clinicianId,
          signalType: 'ENROLLMENT_DENIAL_MICROTREND',
          severity,
          timestamp: now,
          details: {
            summary: `PECOS change stalled: ${stalledChanges.length} pending change(s) for ${longestStall.toFixed(0)}+ days`,
            metric: 'PECOS_STALL_DAYS',
            observedValue: longestStall,
            expectedValue: 0,
            threshold: this.config.pecosStallDays,
            sampleSize: stalledChanges.length,
            evidence: [
              { label: 'Stalled Changes', value: stalledChanges.length },
              { label: 'Longest Stall (days)', value: longestStall },
            ],
            metadata: {
              changeTypes: stalledChanges.map((c) => c.changeType),
            },
          },
          source: 'EnrollmentMicroTrendAnalyzer',
        })
      );
    }

    return signals;
  }

  /**
   * Analyze Medicaid enrollment for unusual shifts
   */
  analyzeMedicaidShifts(
    clinicianId: string,
    enrollments: MedicaidEnrollment[]
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    // Sort by change date or enrollment date
    const sorted = [...enrollments].sort((a, b) => {
      const dateA = a.changeDate ?? a.enrollmentDate;
      const dateB = b.changeDate ?? b.enrollmentDate;
      return dateA.getTime() - dateB.getTime();
    });

    // Count state changes in recent period (last 180 days)
    const now = new Date();
    const recentPeriod = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const recentChanges = sorted.filter((e) => {
      const changeDate = e.changeDate ?? e.enrollmentDate;
      return changeDate >= recentPeriod;
    });

    // Group by state and count status changes
    const stateChanges = new Map<string, number>();
    for (const enrollment of recentChanges) {
      const current = stateChanges.get(enrollment.state) || 0;
      stateChanges.set(enrollment.state, current + 1);
    }

    const totalStateChanges = Array.from(stateChanges.values()).reduce((a, b) => a + b, 0);

    if (totalStateChanges >= this.config.medicaidShiftThreshold) {
      const severity: QualityMicroSignalSeverity = totalStateChanges > this.config.medicaidShiftThreshold * 2 ? 'MEDIUM' : 'LOW';

      signals.push(
        createQualityMicroSignal({
          clinicianId,
          signalType: 'ENROLLMENT_DENIAL_MICROTREND',
          severity,
          timestamp: now,
          details: {
            summary: `Unusual Medicaid enrollment shifts: ${totalStateChanges} state change(s) in recent period`,
            metric: 'MEDICAID_STATE_CHANGES',
            observedValue: totalStateChanges,
            expectedValue: 0,
            threshold: this.config.medicaidShiftThreshold,
            sampleSize: recentChanges.length,
            evidence: [
              { label: 'State Changes', value: totalStateChanges },
              { label: 'States Affected', value: stateChanges.size },
            ],
            metadata: {
              stateBreakdown: Object.fromEntries(stateChanges),
            },
          },
          source: 'EnrollmentMicroTrendAnalyzer',
        })
      );
    }

    return signals;
  }

  /**
   * Extract all enrollment micro-trend signals
   */
  extract(
    clinicianId: string,
    data: {
      payerDenials?: PayerDenial[];
      pecosChanges?: PECOSChange[];
      medicaidEnrollments?: MedicaidEnrollment[];
    }
  ): CreateQualityMicroSignalInput[] {
    const signals: CreateQualityMicroSignalInput[] = [];

    if (data.payerDenials) {
      signals.push(...this.analyzePayerDenials(clinicianId, data.payerDenials));
    }

    if (data.pecosChanges) {
      signals.push(...this.analyzePECOSStalls(clinicianId, data.pecosChanges));
    }

    if (data.medicaidEnrollments) {
      signals.push(...this.analyzeMedicaidShifts(clinicianId, data.medicaidEnrollments));
    }

    return signals;
  }
}

/**
 * Default analyzer instance
 */
export const enrollmentMicroTrendAnalyzer = new EnrollmentMicroTrendAnalyzer();

