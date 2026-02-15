import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { emitVerificationAuditEvent } from '../../verification/audit';
import { registerIngestRoutes } from '../../routes/ingest';
import { registerWedgeRoutes } from '../routes/wedge';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth, trustStateRateLimit, publicApiRateLimit } from './middleware/publicSafety';
import { getRequestOrganizationId, requireOrganizationContext } from './middleware/organizationContext';
import { requestObservability } from './middleware/requestObservability';
import { invokeAgentModel } from './llm';
import { estimateTokenCount } from './telemetry';
import { withToolSpan } from './tools/tracing';
import { requestLatencyMetrics } from './observability/requestMetrics';
import prisma, { Prisma, PrismaClient } from './graphql/prisma_client';
import openApiSpec from './openapi';
import { getLatestArtifact, createArtifactFromNursys, generateAuditBundle } from './services/artifactService';
import { computeTrustState } from './services/trustState';
import { runMonitoringCheck } from './services/monitoringEngine';
import { registerVerifierOnboardingRoutes } from './routes/verifierOnboarding';

type VerificationLane = 'PUBLIC' | 'PARTNER' | 'MANUAL';
const VALID_LANES: readonly VerificationLane[] = ['PUBLIC', 'PARTNER', 'MANUAL'] as const;

type MonitoringFlags = {
  firstViewTracking: boolean;
  artifactGenerationTracking: boolean;
  pilotOrgTracking: boolean;
};

type FunnelRef = 'demo' | 'yc' | 'direct';
type FunnelVariant = 'A' | 'B';
type FunnelEventType =
  | 'verifier_page_view'
  | 'verify_api_call'
  | 'pilot_activation_click'
  | 'pilot_activation_success';

type FunnelVariantAccumulator = {
  clicks: number;
  activations: number;
};

type FunnelEventRow = {
  eventType: string;
  variant: string | null;
  count: bigint | number;
};

type FunnelMetrics = {
  totalVerifierViews: number;
  totalPilotClicks: number;
  totalActivations: number;
  conversionRateByVariant: Record<string, number>;
};

type PilotOrgRow = {
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: string;
  accepted: boolean;
  bundlesGenerated: number;
};

type YcMetricsPayload = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  verifierAcceptances: number;
  estimatedStartDateAccelerationDays: number | null;
  activePilotOrgs: number;
  bundlesGenerated: number;
  estimatedRevenueImpact: number;
  pilotOrgCount: number;
  monitoringFlags: MonitoringFlags;
  verifierConversionRate: number;
  pilotActivationRate: number;
  avgArtifactViewTime: number;
  isDemoMode: boolean;
  pilotOrgs: PilotOrgRow[];
};

const MARKETING_DATABASE_URL = process.env.MARKETING_DATABASE_URL?.trim();
const eventLogPrisma: PrismaClient = (() => {
  const databaseUrl = MARKETING_DATABASE_URL;
  if (!databaseUrl || databaseUrl === process.env.DATABASE_URL?.trim()) {
    return prisma;
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
})();

function normalizeFunnelRef(value: unknown): FunnelRef | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? normalizeFunnelRef(value[0]) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'demo' || normalized === 'yc' || normalized === 'direct') {
    return normalized;
  }
  return null;
}

function normalizeFunnelVariant(value: unknown): FunnelVariant {
  if (typeof value !== 'string') {
    return 'A';
  }
  return value.trim().toUpperCase() === 'B' ? 'B' : 'A';
}

function asRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  const rawRate = numerator / denominator;
  return Number(rawRate.toFixed(4));
}

function toCount(input: bigint | number | string | null): number {
  if (input === null) {
    return 0;
  }
  if (typeof input === 'number') {
    return input;
  }
  if (typeof input === 'bigint') {
    return Number(input);
  }
  return Number.parseInt(input, 10);
}

type EnterprisePosture = {
  rateLimiting: boolean;
  inputValidation: boolean;
  enumLocked: boolean;
  internalRouteProtection: boolean;
  startupEnvValidation: boolean;
};

type ComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  crossCheckEligible: boolean;
  auditSnapshotSupported: boolean;
  trustLedgerAppendOnly: boolean;
};

type VersionResponse = {
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
  prismaVersion: string;
};

const ENTERPRISE_MODE = parseBooleanEnv(process.env.ENTERPRISE_MODE);

const COMPLIANCE_SUMMARY: ComplianceSummary = {
  ncqaAlignment: true,
  monitoringEnabled: true,
  crossCheckEligible: true,
  auditSnapshotSupported: true,
  trustLedgerAppendOnly: true,
};

const SECURITY_POSTURE: EnterprisePosture = {
  rateLimiting: true,
  inputValidation: true,
  enumLocked: true,
  internalRouteProtection: true,
  startupEnvValidation: true,
};

const VERSION_INFO = readVersionInfo();

function parseBooleanEnv(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function readVersionInfo(): VersionResponse {
  const buildVersion =
    process.env.BUILD_VERSION ??
    process.env.npm_package_version ??
    readPackageValue<string>(resolveBackendPackageJsonPath(), 'version') ??
    'unknown';
  const commitHash =
    process.env.COMMIT_HASH ??
    process.env.GIT_COMMIT_HASH ??
    process.env.GITHUB_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'unknown';
  const prismaVersion =
    readPackageValue<string>(readInstalledPrismaPackagePath(), 'version') ??
    readPackageValue<Record<string, string>>(resolveBackendPackageJsonPath(), 'dependencies')?.[
      '@prisma/client'
    ] ??
    'unknown';

  return {
    buildVersion,
    commitHash,
    nodeVersion: process.version,
    prismaVersion,
  };
}

function resolveBackendPackageJsonPath(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/api/backend/package.json'),
    path.resolve(__dirname, '../../package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), 'package.json');
}

function readInstalledPrismaPackagePath(): string {
  const candidate = path.resolve(process.cwd(), 'node_modules/@prisma/client/package.json');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return '/dev/null';
}

function readPackageValue<T>(packageJsonPath: string, key: string): T | undefined {
  try {
    const file = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(file) as Record<string, unknown>;
    const value = parsed[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    return value as T;
  } catch {
    return undefined;
  }
}

function parsePilotMetadataOverrides(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return metadata ?? {};
}

async function logFunnelEvent(
  eventType: FunnelEventType,
  npi: string,
  metadata?: Record<string, unknown>,
  organizationId?: string,
): Promise<void> {
  if (!npi.trim()) {
    return;
  }

  try {
    const normalizedMetadata = parsePilotMetadataOverrides(metadata);
    const payload = JSON.stringify(normalizedMetadata);
    await eventLogPrisma.$executeRaw`
      INSERT INTO "EventLog" ("eventType", "npi", "metadata", "organizationId")
      VALUES (${eventType}, ${npi.trim()}, CAST(${payload} AS JSONB), ${organizationId})
    `;
  } catch (error) {
    console.error(`[funnel] Failed to log event ${eventType}:`, error);
  }
}

async function loadFunnelMetrics(organizationId?: string): Promise<FunnelMetrics> {
  const zero: FunnelMetrics = {
    totalVerifierViews: 0,
    totalPilotClicks: 0,
    totalActivations: 0,
    conversionRateByVariant: {},
  };

  try {
    const rows = await eventLogPrisma.$queryRaw<Array<FunnelEventRow>>`
      SELECT
        "eventType" AS "eventType",
        "metadata"->>'cta_variant' AS "variant",
        COUNT(*)::bigint AS "count"
      FROM "EventLog"
      WHERE ${
        organizationId
          ? Prisma.sql`"organizationId" = ${organizationId} AND `
          : Prisma.sql``
      }
      "eventType" IN ('verifier_page_view', 'verify_api_call', 'pilot_activation_click', 'pilot_activation_success')
      GROUP BY "eventType", "metadata"->>'cta_variant'
    `;

    const byVariant: Record<string, FunnelVariantAccumulator> = {};

    for (const row of rows) {
      const count = toCount(row.count);

      if (row.eventType === 'verifier_page_view') {
        zero.totalVerifierViews += count;
        continue;
      }

      if (row.eventType === 'pilot_activation_click' || row.eventType === 'pilot_activation_success') {
        const variant = normalizeFunnelVariant(row.variant);
        if (!byVariant[variant]) {
          byVariant[variant] = {
            clicks: 0,
            activations: 0,
          };
        }

        if (row.eventType === 'pilot_activation_click') {
          byVariant[variant].clicks += count;
          zero.totalPilotClicks += count;
        } else {
          byVariant[variant].activations += count;
          zero.totalActivations += count;
        }
      }

      if (row.eventType === 'verify_api_call') {
        // Reserved for deeper conversion timing/attribution if needed.
      }
    }

    const conversionRateByVariant: Record<string, number> = {};
    for (const [variant, totals] of Object.entries(byVariant)) {
      conversionRateByVariant[variant] = asRate(totals.activations, totals.clicks);
    }

    return {
      ...zero,
      conversionRateByVariant,
    };
  } catch (error) {
    console.error('[funnel] Failed to load event metrics:', error);
    return zero;
  }
}

const DEMO_PILOT_ORGS: ReadonlyArray<{
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: Date;
  accepted: boolean;
  bundlesGenerated: number;
}> = [
  {
    id: 'demo-pilot-org-alpha',
    name: 'Northpoint Health Group',
    contactEmail: 'pilot-access@northpoint.example',
    activatedAt: new Date('2026-01-09T09:00:00.000Z'),
    accepted: true,
    bundlesGenerated: 2,
  },
  {
    id: 'demo-pilot-org-beta',
    name: 'Summit Care Collective',
    contactEmail: 'pilot-access@summitcare.example',
    activatedAt: new Date('2026-01-10T10:15:00.000Z'),
    accepted: true,
    bundlesGenerated: 1,
  },
];

const BASELINE_START_DATE_DELAY_DAYS = 21;
const AVERAGE_DELAY_REDUCTION_DAYS = 7;
const REVENUE_RECOVERY_PER_DAY_USD = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function parseYcDemoMode(): boolean {
  const raw = process.env.YC_DEMO_MODE;
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseEmail(value: unknown, field: string): string {
  const email = parseRequiredString(value, field);
  if (!email.includes('@')) {
    throw new Error(`${field} must be a valid email address`);
  }

  return email.toLowerCase();
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? parseOptionalString(value[0]) : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function estimateRecoveredRevenue(bundleCount: number): number {
  return bundleCount * AVERAGE_DELAY_REDUCTION_DAYS * REVENUE_RECOVERY_PER_DAY_USD;
}

function collectDemoYcMetrics(): YcMetricsPayload {
  const totalNPIs = 12;
  const shareLinks = 24;
  const verifierViews = 16;
  const avgTimeToView = 24;
  const avgMillisecondsToView = avgTimeToView * 60 * 1000;
  const verifierAcceptances = 2;
  const exports = 3;
  const bundlesGenerated = DEMO_PILOT_ORGS.reduce((sum, org) => sum + org.bundlesGenerated, 0);
  const estimatedStartDateAccelerationDays = toStartDateAcceleration(avgMillisecondsToView) ?? 0;
  const activePilotOrgs = DEMO_PILOT_ORGS.length;
  const estimatedRevenueImpact = estimateRecoveredRevenue(bundlesGenerated);

  return {
    totalNPIs,
    shareLinks,
    verifierViews,
    exports,
    avgTimeToView,
    verifierAcceptances,
    estimatedStartDateAccelerationDays,
    activePilotOrgs,
    bundlesGenerated,
    estimatedRevenueImpact,
    verifierConversionRate: asRate(0, verifierViews),
    pilotActivationRate: asRate(0, 0),
    avgArtifactViewTime: avgTimeToView,
    pilotOrgCount: DEMO_PILOT_ORGS.length,
    monitoringFlags: {
      firstViewTracking: true,
      artifactGenerationTracking: exports > 0,
      pilotOrgTracking: true,
    },
    isDemoMode: true,
    pilotOrgs: DEMO_PILOT_ORGS.map((pilotOrg) => ({
      id: pilotOrg.id,
      name: pilotOrg.name,
      contactEmail: pilotOrg.contactEmail,
      activatedAt: pilotOrg.activatedAt.toISOString(),
      accepted: pilotOrg.accepted,
      bundlesGenerated: pilotOrg.bundlesGenerated,
    })),
  };
}

function parseLane(value: unknown): VerificationLane {
  const normalized = parseRequiredString(value, 'lane').toUpperCase();
  if (!VALID_LANES.includes(normalized as VerificationLane)) {
    throw new Error('lane must be one of PUBLIC | PARTNER | MANUAL');
  }
  return normalized as VerificationLane;
}

function parseDateField(value: unknown): Date {
  if (value === undefined) {
    return new Date();
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('acceptedAt must be an ISO timestamp');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('acceptedAt must be an ISO timestamp');
  }

  return parsed;
}

function toAuditHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function calculateAverageTimeToViewMilliseconds(
  rows: Array<{
    createdAt: Date;
    firstViewedAt: Date | null;
  }>,
): number | null {
  if (rows.length === 0) {
    return null;
  }

  const totalMinutes = rows.reduce((acc, row) => {
    if (!row.firstViewedAt) {
      return acc;
    }
    const deltaMs = row.firstViewedAt.getTime() - row.createdAt.getTime();
    return acc + deltaMs;
  }, 0);

  const sampleCount = rows.filter((row) => row.firstViewedAt).length;
  if (sampleCount === 0) {
    return null;
  }

  return Number((totalMinutes / sampleCount).toFixed(2));
}

function toStartDateAcceleration(avgTimeToViewMilliseconds: number | null): number | null {
  if (avgTimeToViewMilliseconds === null) {
    return null;
  }
  return Number(
    (
      BASELINE_START_DATE_DELAY_DAYS - avgTimeToViewMilliseconds / MS_PER_DAY
    ).toFixed(2),
  );
}

async function loadYcMetrics(): Promise<YcMetricsPayload> {
  if (parseYcDemoMode()) {
    return collectDemoYcMetrics();
  }

  const [shareLinks, verifiedViews, npiGroups, verifierAcceptances, viewRows, exportCount, funnelMetrics, pilotOrgs, activePilotPlans] =
    await Promise.all([
      prisma.shareLink.count(),
      prisma.shareLink.count({ where: { firstViewedAt: { not: null } } }),
      prisma.shareLink.groupBy({ by: ['npi'], _count: { _all: true } }),
      prisma.verifierAcceptance.count(),
      prisma.shareLink.findMany({
        where: { firstViewedAt: { not: null } },
        select: { createdAt: true, firstViewedAt: true },
      }),
      prisma.auditEvent.count({ where: { type: 'ARTIFACT_EXPORTED' } }),
      loadFunnelMetrics(),
      prisma.pilotOrg.findMany({
        orderBy: { activatedAt: 'desc' },
        select: { id: true, name: true, contactEmail: true, activatedAt: true, accepted: true },
      }),
      prisma.pilotPlan.findMany({
        where: { active: true },
        select: { organizationId: true, bundleCount: true },
      }),
    ]);

  const avgMillisecondsToView = calculateAverageTimeToViewMilliseconds(viewRows);
  const avgTimeToView =
    avgMillisecondsToView === null ? 0 : Number((avgMillisecondsToView / (1000 * 60)).toFixed(2));
  const estimatedStartDateAccelerationDays = toStartDateAcceleration(avgMillisecondsToView);

  const bundlesByOrg = new Map<string, number>(
    activePilotPlans
      .filter((plan): plan is typeof plan & { organizationId: string } => plan.organizationId !== null)
      .map((plan) => [plan.organizationId, plan.bundleCount]),
  );
  const activeBundlesGenerated = activePilotPlans.reduce(
    (sum, plan) => sum + plan.bundleCount,
    0,
  );

  const pilotOrgRows: PilotOrgRow[] = pilotOrgs.map((p) => ({
    id: p.id,
    name: p.name,
    contactEmail: p.contactEmail,
    activatedAt: p.activatedAt.toISOString(),
    accepted: p.accepted,
    bundlesGenerated: bundlesByOrg.get(p.id) ?? 0,
  }));

  return {
    totalNPIs: npiGroups.length,
    shareLinks,
    verifierViews: verifiedViews,
    exports: exportCount,
    avgTimeToView,
    verifierAcceptances,
    estimatedStartDateAccelerationDays,
    activePilotOrgs: bundlesByOrg.size,
    bundlesGenerated: activeBundlesGenerated,
    estimatedRevenueImpact: estimateRecoveredRevenue(activeBundlesGenerated),
    verifierConversionRate: asRate(funnelMetrics.totalPilotClicks, funnelMetrics.totalVerifierViews),
    pilotActivationRate: asRate(funnelMetrics.totalActivations, funnelMetrics.totalPilotClicks),
    avgArtifactViewTime: avgTimeToView,
    pilotOrgCount: pilotOrgs.length,
    monitoringFlags: {
      firstViewTracking: verifiedViews > 0,
      artifactGenerationTracking: activeBundlesGenerated > 0,
      pilotOrgTracking: pilotOrgs.length > 0,
    },
    isDemoMode: false,
    pilotOrgs: pilotOrgRows,
  };
}

async function ensureActivePilotPlan(organizationId: string): Promise<void> {
  const existing = await prisma.pilotPlan.findFirst({
    where: {
      organizationId,
      active: true,
    },
  });

  if (existing) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pilotPlan.updateMany({
      where: {
        organizationId,
        active: true,
      },
      data: {
        active: false,
      },
    });

    await tx.pilotPlan.create({
      data: {
        organizationId,
        startDate: new Date(),
        active: true,
      },
    });
  });
}

function registerHealthRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      metrics: requestLatencyMetrics.snapshot(),
    });
  });

  app.get('/readyz', (_req, res) => {
    prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({
          status: 'ready',
          service: 'api',
        });
      })
      .catch(() => {
        res.status(503).json({
          status: 'not_ready',
          service: 'api',
        });
      });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'VitalCV API',
      version: 'mvp',
    });
  });
}

function registerVerificationRoutes(app: Express): void {
  app.post('/verification/request', apiKeyAuth, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const correlationId =
      typeof res.locals.request_id === 'string' && res.locals.request_id.trim().length > 0
        ? res.locals.request_id.trim()
        : crypto.randomUUID();

    const reference_id = crypto.randomUUID();
    let clinician_id = 'clinician:unknown';
    const model = process.env.VITALCV_AGENT_MODEL || 'vitalcv-trust-observer-v1';
    const agentName = process.env.VITALCV_AGENT_NAME || 'trust-observer';
    const traceparent =
      typeof req.get('traceparent') === 'string' ? req.get('traceparent') ?? undefined : undefined;

    try {
      const responsePayload = await invokeAgentModel(
        {
          agentName,
          model,
          input: body,
          traceparent,
        },
        async () => {
          clinician_id = parseRequiredString(body.clinician_id, 'clinician_id');
          const lane = parseLane(body.lane);
          const subject = parseRequiredString(body.subject, 'subject');

          const response = {
            request_id: reference_id,
            clinician_id,
            lane,
            subject,
            status: 'PENDING' as const,
          };

          await withToolSpan(
            {
              toolName: 'emit_verification_audit',
              input: {
                type: 'VERIFICATION_REQUESTED',
                clinician_id,
                lane,
                subject,
                correlation_id: correlationId,
              },
            },
            async () =>
              emitVerificationAuditEvent({
                type: 'VERIFICATION_REQUESTED',
                clinician_id,
                reference_id,
                metadata: {
                  lane,
                  subject,
                  status: 'PENDING',
                  correlation_id: correlationId,
                },
              }),
          );

          return {
            output: response,
            usage: {
              inputTokens: estimateTokenCount(body),
              outputTokens: estimateTokenCount(response),
            },
          };
        },
      );

      return res.status(200).json(responsePayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process verification request';

      try {
        await withToolSpan(
          {
            toolName: 'emit_verification_failed_audit',
            input: {
              clinician_id,
              reason: message,
              correlation_id: correlationId,
            },
            traceparent,
          },
          async () =>
            emitVerificationAuditEvent({
              type: 'VERIFICATION_FAILED',
              clinician_id,
              reference_id,
              metadata: {
                reason: message,
                correlation_id: correlationId,
              },
            }),
        );
      } catch (auditError) {
        console.error('verification audit emission error:', auditError);
      }

      return res.status(400).json({ error: message });
    }
  });
}



function registerPilotRoutes(app: Express): void {
  app.get('/api/verify/:shareId', publicApiRateLimit, async (req: Request, res: Response) => {
    const shareId = parseRequiredString(req.params.shareId, 'shareId');
    const ref = normalizeFunnelRef(req.query.ref);

    try {
      const existing = await prisma.shareLink.findUnique({
        where: { id: shareId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      const now = new Date();
      const isFirstView = existing.firstViewedAt === null;

      const updated = await prisma.shareLink.update({
        where: { id: shareId },
        data: {
          firstViewedAt: existing.firstViewedAt ?? now,
        },
      });

      void logFunnelEvent('verify_api_call', updated.npi, {
        shareId: updated.id,
        isFirstView,
        ...(ref ? { ref } : {}),
      });

      await prisma.auditEvent.create({
        data: {
          type: 'ARTIFACT_VIEWED',
          hash: toAuditHash(`verify:${shareId}`),
          referenceId: updated.id,
          clinicianId: updated.npi,
          ...(updated.organizationId ? { organizationId: updated.organizationId } : {}),
          metadata: {
            shareId: updated.id,
            first_view: isFirstView,
            trace: toAuditHash(`${updated.id}:${updated.npi}:${updated.createdAt.toISOString()}`),
          } as Prisma.InputJsonValue,
        },
      });

      // Resolve or create artifact for this NPI (scoped to share link's org)
      const shareLinkOrgId = updated.organizationId ?? undefined;
      let artifact = await getLatestArtifact(updated.npi, shareLinkOrgId);
      if (!artifact) {
        artifact = await createArtifactFromNursys(updated.npi, shareLinkOrgId);
      }

      const status = artifact.status === 'ACTIVE' ? 'VERIFIED' : artifact.status;
      const monitoringStatus = artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD';
      const trustState = computeTrustState({
        status: artifact.status,
        expiresAt: artifact.expiresAt,
        monitoring: artifact.monitoring,
      });

      return res.status(200).json({
        trustState,
        source: artifact.source,
        status,
        verifiedAt: artifact.verifiedAt.toISOString(),
        expiresAt: artifact.expiresAt?.toISOString() ?? null,
        monitoring: monitoringStatus,
        checksum: artifact.checksum,
        crossCheckEligible: true,
      });
    } catch (error) {
      console.error('verify cross-check error:', error);
      return res.status(500).json({ error: 'Unable to resolve share link' });
    }
  });

  app.post('/api/verifier/accept', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const organization = parseRequiredString(body.organization, 'organization');
    let acceptedAt = new Date();

    try {
      acceptedAt = parseDateField(body.acceptedAt);
      const created = await prisma.verifierAcceptance.create({
        data: {
          organization,
          acceptedAt,
        },
      });

      return res.status(201).json({
        id: created.id,
        organization: created.organization,
        acceptedAt: created.acceptedAt.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create verifier acceptance';
      return res.status(400).json({ error: message });
    }
  });

  app.post('/api/pilot/activate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const organizationName = parseRequiredString(body.organizationName, 'organizationName');
    const contactEmail = parseEmail(body.contactEmail, 'contactEmail');
    const ctaVariant = normalizeFunnelVariant(body.ctaVariant ?? body.cta_variant);
    const ref = normalizeFunnelRef(body.ref);
    const eventNpi =
      typeof body.npi === 'string' && body.npi.trim().length > 0 ? body.npi.trim() : 'pilot_activation';

    try {
      void logFunnelEvent('pilot_activation_click', eventNpi, {
        cta_variant: ctaVariant,
        ...(ref ? { ref } : {}),
      });

      const existing = await prisma.pilotOrg.findFirst({
        where: {
          name: organizationName,
          contactEmail,
        },
      });

      if (existing) {
        const activated = existing.accepted
          ? existing
          : await prisma.pilotOrg.update({
              where: { id: existing.id },
              data: {
                accepted: true,
                activatedAt: new Date(),
              },
            });
        await ensureActivePilotPlan(activated.id);

        void logFunnelEvent('pilot_activation_success', eventNpi, {
          cta_variant: ctaVariant,
          ...(ref ? { ref } : {}),
          status: 'existing',
        });

        return res.status(200).json({
          id: activated.id,
          organization: activated.name,
          contactEmail: activated.contactEmail,
          activatedAt: activated.activatedAt.toISOString(),
          accepted: activated.accepted,
        });
      }

      const created = await prisma.pilotOrg.create({
        data: {
          name: organizationName,
          contactEmail,
          accepted: true,
        },
      });
      await ensureActivePilotPlan(created.id);

      void logFunnelEvent('pilot_activation_success', eventNpi, {
        cta_variant: ctaVariant,
        ...(ref ? { ref } : {}),
        status: 'created',
      });

      return res.status(201).json({
        id: created.id,
        organization: created.name,
        contactEmail: created.contactEmail,
        activatedAt: created.activatedAt.toISOString(),
        accepted: created.accepted,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to activate pilot organization';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/metrics/yc', async (_req: Request, res: Response) => {
    try {
      const payload = await loadYcMetrics();
      return res.status(200).json(payload);
    } catch (error) {
      console.error('YC metrics error:', error);
      return res.status(500).json({ error: 'Unable to compute YC metrics' });
    }
  });

  app.get('/api/internal/funnel-report', async (_req: Request, res: Response) => {
    try {
      const payload = await loadFunnelMetrics();
      return res.status(200).json(payload);
    } catch (error) {
      console.error('Funnel report error:', error);
      return res.status(500).json({ error: 'Unable to compute funnel report' });
    }
  });

  app.get('/api/pilot/report', async (_req: Request, res: Response) => {
    try {
      const payload = await loadYcMetrics();
      return res.status(200).json(payload);
    } catch (error) {
      console.error('Pilot report error:', error);
      return res.status(500).json({ error: 'Unable to compute pilot report' });
    }
  });

  // ── Wave 11: NCQA Audit-Ready Bundle Generator ──────────────
  app.get('/api/artifact/bundle/:npi', publicApiRateLimit, async (req: Request, res: Response) => {
    try {
      const npi = parseRequiredString(req.params.npi, 'npi');
      const organizationId = parseOptionalString(req.query.organizationId);

      const bundle = await generateAuditBundle(npi, { organizationId });

      return res.status(200).json({
        npi: bundle.npi,
        artifact: {
          id: bundle.artifact.id,
          source: bundle.artifact.source,
          status: bundle.artifact.status,
          checksum: bundle.artifact.checksum,
          verifiedAt: bundle.artifact.verifiedAt.toISOString(),
          expiresAt: bundle.artifact.expiresAt?.toISOString() ?? null,
          monitoring: bundle.artifact.monitoring,
        },
        auditMetadata: bundle.auditMetadata,
        snapshotId: bundle.snapshotId,
      });
    } catch (error) {
      console.error('artifact bundle error:', error);
      const message = error instanceof Error ? error.message : 'Unable to generate audit bundle';
      return res.status(500).json({ error: message });
    }
  });
}

function registerTrustStateRoutes(app: Express): void {
  // Trust-state is read-only and rate-limited (no API key required)
  app.get('/trust-state/:clinician_id', trustStateRateLimit, (req: Request, res: Response, next) => {
    const clinician_id =
      typeof req.params.clinician_id === 'string' ? req.params.clinician_id.trim() : '';
    if (!clinician_id) {
      return res.status(400).json({ error: 'clinician_id is required' });
    }

    const queryIndex = req.url.indexOf('?');
    const rawQuery = queryIndex >= 0 ? req.url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(rawQuery);
    params.set('clinician_id', clinician_id);
    (req as Request & { query: Record<string, unknown> }).query = {
      ...(req.query as Record<string, unknown>),
      clinician_id,
    };
    req.url = `/trust-state?${params.toString()}`;
    return next();
  });
}

// ─── Wave 14: Continuous Monitoring Engine ───────────────────

function registerMonitoringRoutes(app: Express): void {
  app.post('/api/internal/monitoring/run', async (req: Request, res: Response) => {
    const secret = req.headers['x-monitoring-secret'];
    const expected = process.env.MONITORING_SECRET;

    if (!expected || secret !== expected) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      // Find all NPIs with monitoring=true
      const monitored = await prisma.verificationArtifact.findMany({
        where: { monitoring: true },
        distinct: ['npi'],
        orderBy: { createdAt: 'desc' },
        select: { npi: true },
      });

      const results = [];
      let checksRun = 0;
      let statusChanges = 0;

      for (const { npi } of monitored) {
        const result = await runMonitoringCheck(npi);
        checksRun++;
        if (result.changed) statusChanges++;
        results.push(result);
      }

      return res.status(200).json({
        monitoringChecksRun: checksRun,
        monitoringStatusChanges: statusChanges,
        results,
      });
    } catch (error) {
      console.error('monitoring run error:', error);
      const message = error instanceof Error ? error.message : 'Monitoring run failed';
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Express Application ────────────────────────────────────

const app = express();

// Security headers
app.use(helmet());

// CORS
const corsOrigin = process.env.CORS_ORIGIN?.trim() || '*';
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  throw new Error('CORS_ORIGIN must not be "*" in production');
}
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
    credentials: corsOrigin !== '*',
  }),
);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Observability
app.use(requestObservability);

// Routes
registerHealthRoutes(app);
registerIngestRoutes(app);
registerVerificationRoutes(app);
registerPilotRoutes(app);
registerTrustStateRoutes(app);
registerMonitoringRoutes(app);
registerVerifierOnboardingRoutes(app);
registerWedgeRoutes(app);

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

// Error handler (must be last)
app.use(errorHandler);

export default app;
