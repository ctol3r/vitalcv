import { createHash } from 'node:crypto';
import type { PassportData } from '@/lib/trust/passport-contract';

type PassportRouteStatus = 'success' | 'failure';
type DegradedStateCategory =
  | 'none'
  | 'source_unavailable'
  | 'source_incomplete'
  | 'runtime_failure';

type PassportRuntimeLogEntry = {
  component: 'passport-runtime';
  event: `passport.runtime.hydration.${PassportRouteStatus}`;
  route: string;
  status: PassportRouteStatus;
  runtimeRole: 'passport-app-router';
  runtimeTopology: 'self-contained-app-router';
  entityKind: 'npi' | 'entity' | 'unknown';
  entityFingerprint: string;
  hydrationLatencyMs: number;
  degradedState?: {
    emitted: boolean;
    category: DegradedStateCategory;
    reason: string | null;
  };
  sourceAvailability?: Array<{
    sourceId: string;
    state: string;
    checkedAtPresent: boolean;
  }>;
  sourceAvailabilitySummary?: Record<string, number>;
  sourceReachability?: {
    reachable: number;
    unavailable: number;
    pending: number;
    degraded: number;
  };
  replayEmission?: {
    emitted: boolean;
    status: string | null;
    lineageKeyPresent: boolean;
    checkedAtPresent: boolean;
  };
  continuityEmission?: {
    emitted: boolean;
    status: string | null;
  };
  issuerEmission?: {
    emitted: boolean;
    status: string | null;
  };
  deploymentDiagnostics: {
    nodeEnv: string;
    vercelEnv: string | null;
    gitSha: string | null;
    gitRef: string | null;
    deploymentUrlPresent: boolean;
    region: string | null;
  };
  errorName?: string;
  errorMessage?: string;
};

function entityKind(value: string): PassportRuntimeLogEntry['entityKind'] {
  if (/^\d{10}$/.test(value)) return 'npi';
  if (value.trim().length > 0) return 'entity';
  return 'unknown';
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function sanitizeOperationalText(value: string): string {
  return value
    .replace(/\b\d{10}\b/g, '[npi]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .slice(0, 240);
}

function sourceAvailability(passport: PassportData): NonNullable<PassportRuntimeLogEntry['sourceAvailability']> {
  return (passport.sourceCoverage?.checks ?? []).map((check) => ({
    sourceId: check.sourceId,
    state: check.state,
    checkedAtPresent: Boolean(check.checkedAt),
  }));
}

function sourceAvailabilitySummary(
  availability: NonNullable<PassportRuntimeLogEntry['sourceAvailability']>,
): Record<string, number> {
  return availability.reduce<Record<string, number>>((summary, source) => {
    summary[source.state] = (summary[source.state] ?? 0) + 1;
    return summary;
  }, {});
}

function sourceReachability(
  availability: NonNullable<PassportRuntimeLogEntry['sourceAvailability']>,
): NonNullable<PassportRuntimeLogEntry['sourceReachability']> {
  return availability.reduce<NonNullable<PassportRuntimeLogEntry['sourceReachability']>>(
    (summary, source) => {
      if (source.state === 'checked') {
        summary.reachable += 1;
      } else if (source.state === 'unavailable') {
        summary.unavailable += 1;
      } else if (source.state === 'pending') {
        summary.pending += 1;
      } else {
        summary.degraded += 1;
      }
      return summary;
    },
    {
      reachable: 0,
      unavailable: 0,
      pending: 0,
      degraded: 0,
    },
  );
}

function degradedState(passport: PassportData & { _degraded?: boolean }): NonNullable<PassportRuntimeLogEntry['degradedState']> {
  if (!passport._degraded) {
    return {
      emitted: false,
      category: 'none',
      reason: null,
    };
  }

  const checks = passport.sourceCoverage?.checks ?? [];
  if (checks.some((check) => check.sourceId.toLowerCase().includes('nppes') && check.state === 'unavailable')) {
    return {
      emitted: true,
      category: 'source_unavailable',
      reason: 'NPPES identity source unavailable; structured degraded passport emitted.',
    };
  }
  if (checks.some((check) => check.state === 'checked') && checks.some((check) => check.state !== 'checked')) {
    return {
      emitted: true,
      category: 'source_incomplete',
      reason: 'Partial source coverage; unchecked lanes remain pending.',
    };
  }

  return {
    emitted: true,
    category: 'source_incomplete',
    reason: sanitizeOperationalText(
      passport.trustPosture?.blockers?.[0] ?? 'Structured degraded passport emitted.',
    ),
  };
}

function deploymentDiagnostics(): PassportRuntimeLogEntry['deploymentDiagnostics'] {
  // Railway is canonical; VERCEL_* / NEXT_PUBLIC_VERCEL_URL remain as
  // backwards-compatible fallbacks only.
  return {
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    vercelEnv: process.env.RAILWAY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? null,
    gitSha: (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null)?.slice(0, 12) ?? null,
    gitRef: process.env.RAILWAY_GIT_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? null,
    deploymentUrlPresent: Boolean(process.env.RAILWAY_PUBLIC_DOMAIN ?? process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL),
    region: process.env.RAILWAY_REGION ?? process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? null,
  };
}

function baseEntry(input: {
  route: string;
  entityId: string;
  status: PassportRouteStatus;
  hydrationLatencyMs: number;
}): Pick<
  PassportRuntimeLogEntry,
  | 'component'
  | 'event'
  | 'route'
  | 'status'
  | 'runtimeRole'
  | 'runtimeTopology'
  | 'entityKind'
  | 'entityFingerprint'
  | 'hydrationLatencyMs'
> {
  return {
    component: 'passport-runtime',
    event: `passport.runtime.hydration.${input.status}`,
    route: input.route,
    status: input.status,
    runtimeRole: 'passport-app-router',
    runtimeTopology: 'self-contained-app-router',
    entityKind: entityKind(input.entityId),
    entityFingerprint: fingerprint(input.entityId),
    hydrationLatencyMs: input.hydrationLatencyMs,
  };
}

export function logPassportRuntimeSuccess(input: {
  route: string;
  entityId: string;
  passport: PassportData & { _degraded?: boolean };
  startedAt: number;
}) {
  const availability = sourceAvailability(input.passport);
  const entry: PassportRuntimeLogEntry = {
    ...baseEntry({
      route: input.route,
      entityId: input.entityId,
      status: 'success',
      hydrationLatencyMs: Math.max(0, Math.round(performance.now() - input.startedAt)),
    }),
    degradedState: degradedState(input.passport),
    sourceAvailability: availability,
    sourceAvailabilitySummary: sourceAvailabilitySummary(availability),
    sourceReachability: sourceReachability(availability),
    replayEmission: {
      emitted: Boolean(input.passport.replayPosture),
      status: input.passport.replayPosture?.status ?? null,
      lineageKeyPresent: Boolean(input.passport.lineageKey),
      checkedAtPresent: Boolean(input.passport.checkedAt),
    },
    continuityEmission: {
      emitted: Boolean(input.passport.continuityPosture),
      status: input.passport.continuityPosture?.status ?? null,
    },
    issuerEmission: {
      emitted: Boolean(input.passport.issuerPosture),
      status: input.passport.issuerPosture?.status ?? null,
    },
    deploymentDiagnostics: deploymentDiagnostics(),
  };

  console.info(JSON.stringify(entry));
}

export function logPassportRuntimeFailure(input: {
  route: string;
  entityId: string;
  error: unknown;
  startedAt: number;
}) {
  const error = input.error instanceof Error ? input.error : null;
  const entry: PassportRuntimeLogEntry = {
    ...baseEntry({
      route: input.route,
      entityId: input.entityId,
      status: 'failure',
      hydrationLatencyMs: Math.max(0, Math.round(performance.now() - input.startedAt)),
    }),
    degradedState: {
      emitted: false,
      category: 'runtime_failure',
      reason: 'Passport runtime failed before a degraded response could be emitted.',
    },
    deploymentDiagnostics: deploymentDiagnostics(),
    errorName: error?.name ?? typeof input.error,
    errorMessage: error?.message ? sanitizeOperationalText(error.message) : undefined,
  };

  console.error(JSON.stringify(entry));
}
