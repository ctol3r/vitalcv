import { PrismaClient } from '@prisma/client';
import { log } from '../obs/logger';

export type VerifierLifecycle =
  | 'REGISTERED'
  | 'TOKEN_SENT'
  | 'TOKEN_USED'
  | 'PILOT_ACTIVATED'
  | 'BUNDLE_GENERATED';

export const VERIFIER_LIFECYCLE_STATES: readonly VerifierLifecycle[] = [
  'REGISTERED',
  'TOKEN_SENT',
  'TOKEN_USED',
  'PILOT_ACTIVATED',
  'BUNDLE_GENERATED',
] as const;

export const VERIFIER_LIFECYCLE_EVENT_TYPES = {
  REGISTERED: 'VERIFIER_LIFECYCLE_REGISTERED',
  TOKEN_SENT: 'VERIFIER_LIFECYCLE_TOKEN_SENT',
  TOKEN_USED: 'VERIFIER_LIFECYCLE_TOKEN_USED',
  PILOT_ACTIVATED: 'VERIFIER_LIFECYCLE_PILOT_ACTIVATED',
  BUNDLE_GENERATED: 'VERIFIER_LIFECYCLE_BUNDLE_GENERATED',
} as const;

export const VERIFIER_LIFECYCLE_EVENT_TYPE_MAP: Record<VerifierLifecycle, string> =
  VERIFIER_LIFECYCLE_EVENT_TYPES;

const VERIFIER_LIFECYCLE_BY_LABEL: Record<string, VerifierLifecycle> = {
  REGISTERED: 'REGISTERED',
  TOKEN_SENT: 'TOKEN_SENT',
  TOKEN_USED: 'TOKEN_USED',
  PILOT_ACTIVATED: 'PILOT_ACTIVATED',
  BUNDLE_GENERATED: 'BUNDLE_GENERATED',
};

const VERIFIER_LIFECYCLE_RANK: Record<VerifierLifecycle, number> = {
  REGISTERED: 0,
  TOKEN_SENT: 1,
  TOKEN_USED: 2,
  PILOT_ACTIVATED: 3,
  BUNDLE_GENERATED: 4,
};

export type VerifierLifecycleTransitionAssessment = {
  allowed: boolean;
  reason?: string;
  noOp?: boolean;
};

function createEventLogPrismaClient(): PrismaClient {
  const databaseUrl = process.env.MARKETING_DATABASE_URL?.trim();
  if (!databaseUrl || databaseUrl === process.env.DATABASE_URL?.trim()) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

const eventLogPrisma = createEventLogPrismaClient();

export function coerceVerifierLifecycle(
  value: string | null | undefined,
): VerifierLifecycle {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return VERIFIER_LIFECYCLE_BY_LABEL[normalized] ?? 'REGISTERED';
}

export function assessVerifierLifecycleTransition(
  current: VerifierLifecycle,
  target: VerifierLifecycle,
): VerifierLifecycleTransitionAssessment {
  if (current === target) {
    return {
      allowed: true,
      noOp: true,
    };
  }

  const delta = VERIFIER_LIFECYCLE_RANK[target] - VERIFIER_LIFECYCLE_RANK[current];
  if (delta !== 1) {
    return {
      allowed: false,
      reason: `Cannot transition verifier lifecycle from ${current} to ${target}: non-linear transitions are disallowed.`,
    };
  }

  return { allowed: true };
}

export function isVerifierLifecycleAtLeast(
  current: VerifierLifecycle,
  minimum: VerifierLifecycle,
): boolean {
  return VERIFIER_LIFECYCLE_RANK[current] >= VERIFIER_LIFECYCLE_RANK[minimum];
}

export function getVerifierLifecycleEventType(
  lifecycle: VerifierLifecycle,
): string {
  return VERIFIER_LIFECYCLE_EVENT_TYPE_MAP[lifecycle];
}

export async function logVerifierLifecycleTransitionEvent(
  verifierOrgId: string,
  from: VerifierLifecycle,
  to: VerifierLifecycle,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const eventType = getVerifierLifecycleEventType(to);
  const payload = JSON.stringify({
    from,
    to,
    ...(metadata ?? {}),
    loggedAt: new Date().toISOString(),
  });

  await eventLogPrisma.$executeRaw`
    INSERT INTO "EventLog" ("eventType", "npi", "metadata", "organizationId")
    VALUES (${eventType}, ${`verifier:${verifierOrgId}`}, CAST(${payload} AS JSONB), ${verifierOrgId})
  `;
}

export function createVerifierLifecycleTransitionError(
  current: VerifierLifecycle,
  target: VerifierLifecycle,
  reason: string,
): Error {
  const error = new Error(
    `Invalid verifier lifecycle transition from ${current} to ${target}`,
  );
  log('error', 'verifier_lifecycle_transition_blocked', {
    event: 'verifier_lifecycle_transition_invalid',
    currentLifecycle: current,
    targetLifecycle: target,
    reason,
  });
  return error;
}

export function logLifecycleTransitionPersistenceFailure(
  verifierOrgId: string,
  from: VerifierLifecycle,
  to: VerifierLifecycle,
  message: string,
): void {
  log('error', 'verifier_lifecycle_transition_persistence_failed', {
    event: 'verifier_lifecycle_persistence_error',
    verifierOrgId,
    from,
    to,
    message,
  });
}
