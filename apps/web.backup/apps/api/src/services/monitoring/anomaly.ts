import type { MonitoringGrid } from '@prisma/client';
import type { MonitorRunOutput, MonitoringAnomaly, MonitoringItemType } from './types';

export function detectMonitoringAnomalies(
  results: MonitorRunOutput[],
  previousMap: Map<MonitoringItemType, MonitoringGrid | null>,
): MonitoringAnomaly[] {
  const anomalies: MonitoringAnomaly[] = [];
  const now = new Date();

  for (const result of results) {
    const previous = previousMap.get(result.itemType);
    if (
      previous &&
      previous.status !== 'critical' &&
      result.status === 'critical' &&
      (result.itemType === 'license' || result.itemType === 'board')
    ) {
      anomalies.push({
        type: 'sudden_revocation',
        severity: 'high',
        summary: `${humanize(result.itemType)} moved from ${previous.status} to critical`,
        detectedAt: now.toISOString(),
        relatedItems: [result.itemType],
      });
    }

    if (
      (result.itemType === 'sanction' || result.itemType === 'npdb') &&
      hoursBetween(result.lastCheck, now) > 24 * 14
    ) {
      anomalies.push({
        type: 'monitor_gap',
        severity: 'medium',
        summary: `${humanize(result.itemType)} feed stale for ${Math.round(
          hoursBetween(result.lastCheck, now) / 24,
        )} days`,
        detectedAt: now.toISOString(),
        relatedItems: [result.itemType],
      });
    }
  }

  const license = results.find((entry) => entry.itemType === 'license');
  const board = results.find((entry) => entry.itemType === 'board');
  if (license && board) {
    const deltaDays = Math.abs(daysBetween(license.nextCheck, board.nextCheck));
    if (deltaDays > 60) {
      anomalies.push({
        type: 'renewal_mismatch',
        severity: 'medium',
        summary: `License vs board renewal cadence differs by ${deltaDays} days`,
        detectedAt: now.toISOString(),
        relatedItems: ['license', 'board'],
      });
    }
  }

  return anomalies;
}

function humanize(item: MonitoringItemType): string {
  switch (item) {
    case 'dea':
      return 'DEA credential';
    case 'sanction':
      return 'Sanctions monitor';
    case 'npdb':
      return 'NPDB monitor';
    case 'board':
      return 'Board certification';
    case 'license':
    default:
      return 'License';
  }
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}










