import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_WINDOW_DAYS = 90;
const DEADLINE_CAP = 6;
const MISMATCH_CAP = 5;
const REVOKED_CAP = 3;

export type BehavioralRiskFlag =
  | 'MISSED_DEADLINES'
  | 'MISMATCH_LOOP'
  | 'CREDENTIAL_REVOKED'
  | 'STABLE_BEHAVIOR';

export interface BehavioralSignalInput {
  clinicianId: string;
  missedDocumentDeadlines: number;
  repeatedMismatches: number;
  revokedCredentials: number;
  observationWindowDays?: number;
}

export interface BehavioralSignalResult {
  behaviorScore: number;
  flags: BehavioralRiskFlag[];
  normalized: {
    missedDocumentDeadlines: number;
    repeatedMismatches: number;
    revokedCredentials: number;
  };
}

export function scoreBehavioralSignals(
  input: BehavioralSignalInput,
): BehavioralSignalResult {
  const normalizedDeadlines = normalizeRatio(input.missedDocumentDeadlines, DEADLINE_CAP);
  const normalizedMismatches = normalizeRatio(input.repeatedMismatches, MISMATCH_CAP);
  const normalizedRevocations = normalizeRatio(input.revokedCredentials, REVOKED_CAP);

  const behaviorScore = Number(
    clamp01(
      normalizedDeadlines * 0.4 +
        normalizedMismatches * 0.35 +
        normalizedRevocations * 0.25,
    ).toFixed(4),
  );

  const flags: BehavioralRiskFlag[] = [];
  if (input.missedDocumentDeadlines >= 3) {
    flags.push('MISSED_DEADLINES');
  }
  if (input.repeatedMismatches >= 2) {
    flags.push('MISMATCH_LOOP');
  }
  if (input.revokedCredentials >= 1) {
    flags.push('CREDENTIAL_REVOKED');
  }
  if (!flags.length) {
    flags.push('STABLE_BEHAVIOR');
  }

  return {
    behaviorScore,
    flags,
    normalized: {
      missedDocumentDeadlines: Number(normalizedDeadlines.toFixed(4)),
      repeatedMismatches: Number(normalizedMismatches.toFixed(4)),
      revokedCredentials: Number(normalizedRevocations.toFixed(4)),
    },
  };
}

export async function ingestBehavioralSignals(
  input: BehavioralSignalInput,
): Promise<BehavioralSignalResult> {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required to record behavioral signals');
  }

  const result = scoreBehavioralSignals(input);

  await prisma.riskEvent.create({
    data: {
      clinicianId: input.clinicianId,
      type: 'behavior',
      severity: result.behaviorScore,
      metadata: {
        observationWindowDays: input.observationWindowDays ?? DEFAULT_WINDOW_DAYS,
        missedDocumentDeadlines: input.missedDocumentDeadlines,
        repeatedMismatches: input.repeatedMismatches,
        revokedCredentials: input.revokedCredentials,
        normalized: result.normalized,
        flags: result.flags,
      },
    },
  });

  return result;
}

function normalizeRatio(value: number, cap: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return clamp01(value / cap);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

