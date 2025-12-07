import type { ReadinessSignal as ReadinessSignalRecord } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import type { ReadinessSignalType } from './signals';

export interface ReadinessChangeDriver {
  type: ReadinessSignalType | string;
  previous: number | null;
  next: number | null;
  delta: number;
}

export interface ReadinessChangeRecord {
  id: string;
  clinicianId: string;
  previousScore: number;
  nextScore: number;
  delta: number;
  changedAt: string;
  drivers: ReadinessChangeDriver[];
  anchorTx: string;
  merkleRoot: string;
}

export interface ReadinessChangeParams {
  clinicianId: string;
  previousScore: number | null;
  nextScore: number;
  previousSignals: ReadinessSignalRecord[];
  currentSignals: ReadinessSignalRecord[];
  threshold?: number;
}

const MAX_ENTRIES = 200;
const readinessChangelog: ReadinessChangeRecord[] = [];

export async function recordReadinessChange(
  params: ReadinessChangeParams,
): Promise<ReadinessChangeRecord | null> {
  if (params.previousScore === null || Number.isNaN(params.previousScore)) {
    return null;
  }

  const delta = params.nextScore - params.previousScore;
  const threshold = params.threshold ?? 0.1;
  if (Math.abs(delta) < threshold) {
    return null;
  }

  const drivers = extractDrivers(params.previousSignals, params.currentSignals);
  const anchor = anchorEvent('readinessDelta', {
    clinicianId: params.clinicianId,
    delta,
    previousScore: params.previousScore,
    nextScore: params.nextScore,
    drivers,
  });

  const record: ReadinessChangeRecord = {
    id: anchor.id,
    clinicianId: params.clinicianId,
    previousScore: params.previousScore,
    nextScore: params.nextScore,
    delta,
    changedAt: anchor.payload.timestamp,
    drivers,
    anchorTx: anchor.txHash,
    merkleRoot: anchor.merkleRoot,
  };

  readinessChangelog.unshift(record);
  if (readinessChangelog.length > MAX_ENTRIES) {
    readinessChangelog.pop();
  }

  return record;
}

export function listReadinessChangelog(
  clinicianId: string,
  limit = 20,
): ReadinessChangeRecord[] {
  const filtered = readinessChangelog.filter((entry) => entry.clinicianId === clinicianId);
  if (limit <= 0) {
    return filtered;
  }
  return filtered.slice(0, limit);
}

function extractDrivers(
  previousSignals: ReadinessSignalRecord[],
  currentSignals: ReadinessSignalRecord[],
): ReadinessChangeDriver[] {
  const previousMap = new Map<string, ReadinessSignalRecord>();
  for (const signal of previousSignals) {
    previousMap.set(signal.type, signal);
  }

  const currentMap = new Map<string, ReadinessSignalRecord>();
  for (const signal of currentSignals) {
    currentMap.set(signal.type, signal);
  }

  const types = new Set<string>([
    ...previousSignals.map((signal) => signal.type),
    ...currentSignals.map((signal) => signal.type),
  ]);

  const drivers: ReadinessChangeDriver[] = [];
  for (const type of types) {
    const before = previousMap.get(type)?.score ?? null;
    const after = currentMap.get(type)?.score ?? null;
    if (before === null && after === null) continue;
    const delta =
      (after ?? 0) - (before ?? 0);
    if (Math.abs(delta) < 0.05) {
      continue;
    }
    drivers.push({
      type,
      previous: before,
      next: after,
      delta,
    });
  }

  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return drivers.slice(0, 5);
}










