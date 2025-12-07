import { randomUUID } from 'crypto';
import type { WorkforceForecastEntry } from '../workforce/forecast';

export type WorkforceAlertType = 'shortageCritical' | 'shortageHigh' | 'surgeRecommended';
export type WorkforceAlertSeverity = 'info' | 'warning' | 'critical';

export interface WorkforceAlert {
  id: string;
  type: WorkforceAlertType;
  severity: WorkforceAlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function evaluateWorkforceAlerts(
  entries: WorkforceForecastEntry[],
): WorkforceAlert[] {
  const alerts: WorkforceAlert[] = [];

  entries.forEach((entry) => {
    if (entry.shortageIndex >= 0.75) {
      alerts.push(
        createAlert('shortageCritical', 'critical', {
          message: `${entry.specialty} in ${entry.region} is forecasted at ${
            (entry.shortageIndex * 100).toFixed(0)
          }% shortage.`,
          metadata: {
            specialty: entry.specialty,
            region: entry.region,
            shortageIndex: entry.shortageIndex,
            recommendedHires: entry.recommendedHires,
          },
        }),
      );
      alerts.push(
        createAlert('surgeRecommended', 'warning', {
          message: `Launch surge hiring template (${entry.recommendedHires} hires)`,
          metadata: {
            specialty: entry.specialty,
            region: entry.region,
            recommendedHires: entry.recommendedHires,
            surgeReadiness: entry.surgeReadiness,
          },
        }),
      );
    } else if (entry.shortageIndex >= 0.6) {
      alerts.push(
        createAlert('shortageHigh', 'warning', {
          message: `${entry.specialty} demand trending high over next 60 days.`,
          metadata: {
            specialty: entry.specialty,
            region: entry.region,
            shortageIndex: entry.shortageIndex,
          },
        }),
      );
    }
  });

  return alerts;
}

function createAlert(
  type: WorkforceAlertType,
  severity: WorkforceAlertSeverity,
  details: { message: string; metadata?: Record<string, unknown> },
): WorkforceAlert {
  return {
    id: randomUUID(),
    type,
    severity,
    message: details.message,
    metadata: details.metadata,
    createdAt: new Date().toISOString(),
  };
}










