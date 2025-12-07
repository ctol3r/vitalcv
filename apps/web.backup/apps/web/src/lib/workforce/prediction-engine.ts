/**
 * Workforce Prediction Engine
 * Phase 4: Workforce Forecasting & Predictions
 */

import type {
  WorkforcePrediction,
  SpecialtyShortage,
  LicensureExpiration,
  DEARenewalWave,
  CredentialCycle,
  ChainInconsistency,
} from './models';

export class WorkforcePredictionEngine {
  /**
   * Forecast shortages by specialty
   */
  static forecastShortages(
    currentCounts: Record<string, number>,
    projectedRetirements: Record<string, number>,
    forecastDate: Date,
  ): SpecialtyShortage[] {
    const shortages: SpecialtyShortage[] = [];

    for (const [specialty, currentCount] of Object.entries(currentCounts)) {
      const projectedRetirement = projectedRetirements[specialty] || 0;
      const projectedCount = currentCount - projectedRetirement;
      const targetCount = currentCount; // Assume target is current count
      const deficit = Math.max(0, targetCount - projectedCount);

      if (deficit > 0) {
        shortages.push({
          specialty,
          currentCount,
          projectedCount,
          deficit,
          forecastDate: forecastDate.toISOString(),
          urgency: deficit > targetCount * 0.2 ? 'critical' : deficit > targetCount * 0.1 ? 'high' : 'medium',
        });
      }
    }

    return shortages.sort((a, b) => b.deficit - a.deficit);
  }

  /**
   * Forecast expiring licensure
   */
  static forecastLicensureExpiration(
    licenses: Array<{ state: string; expirationDate: string }>,
  ): LicensureExpiration[] {
    const now = new Date();
    const expirationMap = new Map<string, number>();

    for (const license of licenses) {
      const expirationDate = new Date(license.expirationDate);
      if (expirationDate > now) {
        const key = license.state;
        expirationMap.set(key, (expirationMap.get(key) || 0) + 1);
      }
    }

    return Array.from(expirationMap.entries()).map(([state, count]) => {
      // Find earliest expiration for this state
      const stateLicenses = licenses.filter((l) => l.state === state);
      const earliestExpiration = stateLicenses
        .map((l) => new Date(l.expirationDate))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      return {
        state,
        count,
        expirationDate: earliestExpiration.toISOString(),
        daysUntilExpiration: Math.ceil(
          (earliestExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      };
    });
  }

  /**
   * Forecast DEA renewal waves
   */
  static forecastDEARenewalWaves(
    deaRenewals: Array<{ expirationDate: string }>,
  ): DEARenewalWave[] {
    const now = new Date();
    const monthMap = new Map<string, number>();

    for (const renewal of deaRenewals) {
      const expirationDate = new Date(renewal.expirationDate);
      if (expirationDate > now) {
        const monthKey = `${expirationDate.getFullYear()}-${String(expirationDate.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
      }
    }

    return Array.from(monthMap.entries())
      .map(([month, count]) => ({
        month,
        count,
        urgency: count > 50 ? 'critical' : count > 20 ? 'high' : 'medium',
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Forecast annual credential cycles
   */
  static forecastCredentialCycles(
    credentials: Array<{ type: string; renewalMonth: string; processingDays: number }>,
  ): CredentialCycle[] {
    const cycleMap = new Map<string, { count: number; avgProcessingDays: number }>();

    for (const cred of credentials) {
      const existing = cycleMap.get(cred.type) || { count: 0, avgProcessingDays: 0 };
      cycleMap.set(cred.type, {
        count: existing.count + 1,
        avgProcessingDays: (existing.avgProcessingDays * existing.count + cred.processingDays) / (existing.count + 1),
      });
    }

    return Array.from(cycleMap.entries()).map(([type, data]) => ({
      type,
      renewalMonth: credentials.find((c) => c.type === type)?.renewalMonth || 'Unknown',
      count: data.count,
      averageProcessingDays: Math.round(data.avgProcessingDays),
    }));
  }

  /**
   * Forecast chain inconsistencies
   */
  static forecastChainInconsistencies(
    units: Array<{
      unitId: string;
      staleAnchors: number;
      missingEvidence: number;
      hashMismatches: number;
    }>,
  ): ChainInconsistency[] {
    const inconsistencies: ChainInconsistency[] = [];

    for (const unit of units) {
      if (unit.staleAnchors > 0) {
        inconsistencies.push({
          unitId: unit.unitId,
          inconsistencyType: 'stale_anchor',
          affectedCount: unit.staleAnchors,
          severity: unit.staleAnchors > 10 ? 'critical' : unit.staleAnchors > 5 ? 'high' : 'medium',
        });
      }

      if (unit.missingEvidence > 0) {
        inconsistencies.push({
          unitId: unit.unitId,
          inconsistencyType: 'missing_evidence',
          affectedCount: unit.missingEvidence,
          severity: unit.missingEvidence > 10 ? 'critical' : unit.missingEvidence > 5 ? 'high' : 'medium',
        });
      }

      if (unit.hashMismatches > 0) {
        inconsistencies.push({
          unitId: unit.unitId,
          inconsistencyType: 'hash_mismatch',
          affectedCount: unit.hashMismatches,
          severity: unit.hashMismatches > 5 ? 'critical' : unit.hashMismatches > 2 ? 'high' : 'medium',
        });
      }
    }

    return inconsistencies.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate comprehensive workforce prediction
   */
  static generatePrediction(data: {
    currentCounts: Record<string, number>;
    projectedRetirements: Record<string, number>;
    licenses: Array<{ state: string; expirationDate: string }>;
    deaRenewals: Array<{ expirationDate: string }>;
    credentials: Array<{ type: string; renewalMonth: string; processingDays: number }>;
    units: Array<{
      unitId: string;
      staleAnchors: number;
      missingEvidence: number;
      hashMismatches: number;
    }>;
    forecastDate: Date;
  }): WorkforcePrediction {
    return {
      forecastedShortages: this.forecastShortages(
        data.currentCounts,
        data.projectedRetirements,
        data.forecastDate,
      ),
      expiringLicensure: this.forecastLicensureExpiration(data.licenses),
      deaRenewalWaves: this.forecastDEARenewalWaves(data.deaRenewals),
      annualCredentialCycles: this.forecastCredentialCycles(data.credentials),
      chainInconsistencies: this.forecastChainInconsistencies(data.units),
    };
  }

  /**
   * Scenario simulation: "What if X clinicians retire?"
   */
  static simulateScenario(
    basePrediction: WorkforcePrediction,
    scenario: {
      retirements: Array<{ specialty: string; count: number }>;
      forecastDate: Date;
    },
  ): WorkforcePrediction {
    const adjustedCounts: Record<string, number> = {};
    const adjustedRetirements: Record<string, number> = {};

    // Calculate adjusted counts based on scenario
    for (const retirement of scenario.retirements) {
      adjustedRetirements[retirement.specialty] =
        (adjustedRetirements[retirement.specialty] || 0) + retirement.count;
    }

    // Recalculate shortages with scenario
    const currentCounts = basePrediction.forecastedShortages.reduce(
      (acc, shortage) => {
        acc[shortage.specialty] = shortage.currentCount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      ...basePrediction,
      forecastedShortages: this.forecastShortages(
        currentCounts,
        adjustedRetirements,
        scenario.forecastDate,
      ),
    };
  }
}








