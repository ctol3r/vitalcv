import crypto from 'node:crypto';
import prisma from '../graphql/prisma_client';

type LedgerEvent = {
  eventType: 'RECOGNITION' | 'ACCEPTANCE' | 'START';
  eventId: string;
  createdAt: Date;
  subjectId: string;
  referenceId?: string;
  referenceId2?: string;
  eventHash: string;
  timestamp: string;
};

export type TrustChainValidationResult = {
  npi: string;
  subjectId: string;
  valid: boolean;
  invalidTransitions: boolean;
  checksumMismatches: boolean;
  appendOnlyConfirmed: boolean;
  issues: string[];
  totals: {
    recognitions: number;
    acceptances: number;
    starts: number;
    checksumMismatchesCount: number;
    transitionMismatchesCount: number;
    appendOnlyViolationsCount: number;
  };
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function buildExpectedRecognitionHash(row: {
  recognitionId: string;
  subjectId: string;
  employerId: string;
  recognizedAt: Date;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'RECOGNITION_EMITTED',
        payload: {
          recognitionId: row.recognitionId,
          subjectId: row.subjectId,
          employerId: row.employerId,
          recognizedAt: row.recognizedAt.toISOString(),
        },
      }),
    )
    .digest('hex');
}

function buildExpectedAcceptanceHash(row: {
  acceptanceId: string;
  recognitionId: string;
  subjectId: string;
  employerId: string;
  acceptedAt: Date;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'ACCEPTANCE_EMITTED',
        payload: {
          acceptanceId: row.acceptanceId,
          recognitionId: row.recognitionId,
          subjectId: row.subjectId,
          employerId: row.employerId,
          acceptedAt: row.acceptedAt.toISOString(),
        },
      }),
    )
    .digest('hex');
}

function buildExpectedStartHash(row: {
  startId: string;
  acceptanceId: string;
  subjectId: string;
  employerId: string;
  attestedAt: Date;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'START_EMITTED',
        payload: {
          startId: row.startId,
          acceptanceId: row.acceptanceId,
          subjectId: row.subjectId,
          employerId: row.employerId,
          attestedAt: row.attestedAt.toISOString(),
        },
      }),
    )
    .digest('hex');
}

function deriveSubjectIds(npi: string): string[] {
  const normalized = npi.trim();
  return [`clinician:npi:${normalized}`, normalized];
}

function parseNpi(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{10}$/.test(trimmed) ? trimmed : null;
}

function toLedgerEvent(
  entry: {
    subjectId: string;
    createdAt: Date;
    eventHash: string;
    recognitionId?: string;
    recognitionIdLegacy?: string;
    acceptanceId?: string;
    startId?: string;
    acceptedAt?: Date;
    attestedAt?: Date;
    timestamp: string;
  },
  eventType: 'RECOGNITION' | 'ACCEPTANCE' | 'START',
): LedgerEvent {
  if (eventType === 'RECOGNITION') {
    return {
      eventType,
      eventId: entry.recognitionId ?? entry.recognitionIdLegacy ?? '',
      createdAt: entry.createdAt,
      subjectId: entry.subjectId,
      eventHash: entry.eventHash,
      timestamp: entry.createdAt.toISOString(),
      referenceId: undefined,
    };
  }

  if (eventType === 'ACCEPTANCE') {
    return {
      eventType,
      eventId: entry.acceptanceId ?? '',
      createdAt: entry.createdAt,
      subjectId: entry.subjectId,
      eventHash: entry.eventHash,
      timestamp: entry.timestamp ?? entry.createdAt.toISOString(),
      referenceId: entry.recognitionId,
      referenceId2: entry.acceptanceId,
    };
  }

  return {
    eventType,
    eventId: entry.startId ?? '',
    createdAt: entry.createdAt,
    subjectId: entry.subjectId,
    eventHash: entry.eventHash,
    timestamp: entry.timestamp ?? entry.createdAt.toISOString(),
    referenceId: entry.acceptanceId,
    referenceId2: undefined,
  };
}

function addIssue(issues: string[], issue: string): void {
  issues.push(issue);
}

export async function validateTrustChain(npi: string): Promise<TrustChainValidationResult> {
  const validatedNpi = parseNpi(npi);
  if (!validatedNpi) {
    return {
      npi,
      subjectId: npi,
      valid: false,
      invalidTransitions: true,
      checksumMismatches: true,
      appendOnlyConfirmed: false,
      issues: ['Invalid NPI format'],
      totals: {
        recognitions: 0,
        acceptances: 0,
        starts: 0,
        checksumMismatchesCount: 0,
        transitionMismatchesCount: 0,
        appendOnlyViolationsCount: 0,
      },
    };
  }

  const subjectIds = deriveSubjectIds(validatedNpi);
  const [recognitions, acceptances, starts] = await Promise.all([
    prisma.recognition.findMany({
      where: { subjectId: { in: subjectIds } },
      orderBy: { createdAt: 'asc' },
      select: {
        recognitionId: true,
        subjectId: true,
        employerId: true,
        recognizedAt: true,
        createdAt: true,
        eventHash: true,
      },
    }),
    prisma.acceptance.findMany({
      where: { subjectId: { in: subjectIds } },
      orderBy: { acceptedAt: 'asc' },
      select: {
        acceptanceId: true,
        recognitionId: true,
        subjectId: true,
        employerId: true,
        acceptedAt: true,
        createdAt: true,
        eventHash: true,
      },
    }),
    prisma.start.findMany({
      where: { subjectId: { in: subjectIds } },
      orderBy: { attestedAt: 'asc' },
      select: {
        startId: true,
        acceptanceId: true,
        subjectId: true,
        employerId: true,
        attestedAt: true,
        createdAt: true,
        eventHash: true,
      },
    }),
  ]);

  const issues: string[] = [];
  const recognitionById = new Map<string, (typeof recognitions)[number]>();
  for (const rec of recognitions) {
    recognitionById.set(rec.recognitionId, rec);
    if (rec.eventHash !== buildExpectedRecognitionHash(rec)) {
      addIssue(
        issues,
        `checksum mismatch (recognition:${rec.recognitionId}) ${rec.eventHash} != ${buildExpectedRecognitionHash(rec)}`,
      );
    }
  }

  const acceptanceById = new Map<string, (typeof acceptances)[number]>();
  for (const acc of acceptances) {
    acceptanceById.set(acc.acceptanceId, acc);
    if (acc.eventHash !== buildExpectedAcceptanceHash(acc)) {
      addIssue(
        issues,
        `checksum mismatch (acceptance:${acc.acceptanceId}) ${acc.eventHash} != ${buildExpectedAcceptanceHash(acc)}`,
      );
    }

    const recognition = recognitionById.get(acc.recognitionId);
    if (!recognition) {
      addIssue(issues, `invalid transition: acceptance ${acc.acceptanceId} has missing recognition`);
      continue;
    }

    if (acc.acceptedAt.getTime() < recognition.recognizedAt.getTime()) {
      addIssue(
        issues,
        `invalid transition: acceptance ${acc.acceptanceId} accepted before recognition ${acc.recognitionId}`,
      );
    }
  }

  for (const start of starts) {
    if (start.eventHash !== buildExpectedStartHash(start)) {
      addIssue(
        issues,
        `checksum mismatch (start:${start.startId}) ${start.eventHash} != ${buildExpectedStartHash(start)}`,
      );
    }

    const acceptance = acceptanceById.get(start.acceptanceId);
    if (!acceptance) {
      addIssue(issues, `invalid transition: start ${start.startId} has missing acceptance`);
      continue;
    }

    if (start.attestedAt.getTime() <= acceptance.acceptedAt.getTime()) {
      addIssue(
        issues,
        `invalid transition: start ${start.startId} attested before acceptance ${acceptance.acceptanceId}`,
      );
    }
  }

  const eventTimeline: Array<{
    eventType: 'RECOGNITION' | 'ACCEPTANCE' | 'START';
    eventId: string;
    createdAt: number;
    eventHash: string;
  }> = [];

  for (const rec of recognitions) {
    eventTimeline.push({
      eventType: 'RECOGNITION',
      eventId: rec.recognitionId,
      createdAt: rec.createdAt.getTime(),
      eventHash: rec.eventHash,
    });
  }

  for (const acc of acceptances) {
    eventTimeline.push({
      eventType: 'ACCEPTANCE',
      eventId: acc.acceptanceId,
      createdAt: acc.createdAt.getTime(),
      eventHash: acc.eventHash,
    });
  }

  for (const start of starts) {
    eventTimeline.push({
      eventType: 'START',
      eventId: start.startId,
      createdAt: start.createdAt.getTime(),
      eventHash: start.eventHash,
    });
  }

  eventTimeline.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.eventId.localeCompare(b.eventId);
  });

  let appendOnlyViolations = 0;
  for (let index = 1; index < eventTimeline.length; index += 1) {
    if (eventTimeline[index].createdAt < eventTimeline[index - 1].createdAt) {
      appendOnlyViolations += 1;
      addIssue(
        issues,
        `append-only violation between ${eventTimeline[index - 1].eventType}:${eventTimeline[index - 1].eventId} and ${eventTimeline[index].eventType}:${eventTimeline[index].eventId}`,
      );
    }
  }

  const checksumMismatches = issues.some((issue) => issue.startsWith('checksum mismatch'));
  const invalidTransitions = issues.some(
    (issue) => issue.startsWith('invalid transition') || issue.startsWith('append-only'),
  );

  return {
    npi: validatedNpi,
    subjectId: subjectIds[0],
    valid: issues.length === 0,
    invalidTransitions,
    checksumMismatches,
    appendOnlyConfirmed: appendOnlyViolations === 0,
    issues,
    totals: {
      recognitions: recognitions.length,
      acceptances: acceptances.length,
      starts: starts.length,
      checksumMismatchesCount: issues.filter((issue) => issue.startsWith('checksum mismatch')).length,
      transitionMismatchesCount: issues.filter((issue) => issue.startsWith('invalid transition')).length,
      appendOnlyViolationsCount: appendOnlyViolations,
    },
  };
}
