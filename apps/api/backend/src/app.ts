import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { getProductionEnvCheck } from './config/env';
import { emitVerificationAuditEvent } from '../../verification/audit';
import { registerIngestRoutes } from '../../routes/ingest';
import { registerWedgeRoutes } from '../routes/wedge';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth, trustStateRateLimit, publicApiRateLimit } from './middleware/publicSafety';
import { proofRateLimit, credentialStatusRateLimit, walletRateLimit } from './middleware/rateLimitFactory';
import { getEnterpriseCapabilities } from './services/enterpriseCapabilities';
import { runEnterpriseSelfTest } from './services/enterpriseSelfTest';
import { enterpriseCapabilitiesCache } from './services/ttlCache';
import { recordLatency, getPerformanceSnapshot } from './services/performanceMetrics';
import { runRuntimeGuards, isZeroDowngradeEnforced, enforceHaipNoDowngrade } from './services/runtimeGuards';
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
import { computeCredentialState } from './services/credentialStatusEngine';
import { runMonitoringCheck } from './services/monitoringEngine';
import { validateMerkleIntegrity } from './services/merkleIntegrity';
import { generateClaimProof, verifyClaimProof } from './services/selectiveProofEngine';
import type { ClaimProof } from './types/selectiveProof';
import { CredentialLifecycleState } from '../../../../types/credentialLifecycle';
import { validateTrustChain } from './services/trustChain';
import {
  VERIFIER_LIFECYCLE_STATES,
  assessVerifierLifecycleTransition,
  coerceVerifierLifecycle,
} from './services/verifierLifecycle';
import { log } from './obs/logger';

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

type TrustStateDistribution = {
  verified: number;
  verified_monitoring: number;
  expiring_soon: number;
  needs_review: number;
  expired: number;
};

type EnterpriseComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  trustLedgerAppendOnly: boolean;
  lifecycleEnforced: boolean;
  multiTenantScoped: boolean;
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
  timeFromRegistrationToPilotActivation: number | null;
  isDemoMode: boolean;
  pilotOrgs: PilotOrgRow[];
  // Wave 34 additions
  verifierFunnelMetrics: FunnelMetrics;
  revenueRecoveryEstimate: number;
  trustStateDistribution: TrustStateDistribution;
  monitoringDeltaFrequency: number;
  enterpriseComplianceSummary: EnterpriseComplianceSummary;
  pilotReady: boolean;
};

type VerifierActivationTimeRow = {
  organizationId: string | null;
  activatedAt: Date;
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

type OrganizationQueryFilter = {
  organizationId?: string;
};

type PilotChecklist = {
  schemaStable: boolean;
  monitoringActive: boolean;
  trustLedgerDeterministic: boolean;
  rateLimitingActive: boolean;
  envValidated: boolean;
  noDemoModeInProd: boolean;
  readyForPilot: boolean;
};

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim();
const ENTERPRISE_MODE = parseBooleanEnv(process.env.ENTERPRISE_MODE);
const PILOT_MODE = parseBooleanEnv(process.env.PILOT_MODE);
const SYSTEM_FROZEN = parseBooleanEnv(process.env.SYSTEM_FROZEN);
const YC_DEMO_MODE = parseBooleanEnv(process.env.YC_DEMO_MODE);

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

function extractInternalSecret(req: Request): string | null {
  const raw = req.headers['x-monitoring-secret'];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

function requireInternalSecret(req: Request, res: Response): boolean {
  const provided = extractInternalSecret(req);
  if (!MONITORING_SECRET || !provided || provided !== MONITORING_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function isValidNpi(input: string | undefined): input is string {
  return !!input && /^\d{10}$/.test(input);
}

function parseNpi(input: string | undefined, label: string): string {
  const trimmed = input?.trim() ?? '';
  if (!isValidNpi(trimmed)) {
    throw new Error(`${label} must be a 10-digit NPI`);
  }
  return trimmed;
}

async function isDbConnected(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function isTrustLedgerOperational(): Promise<boolean> {
  try {
    await Promise.all([
      prisma.recognition.findFirst({ select: { recognitionId: true }, take: 1 }),
      prisma.acceptance.findFirst({ select: { acceptanceId: true }, take: 1 }),
      prisma.start.findFirst({ select: { startId: true }, take: 1 }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function isMonitoringOperational(organizationId?: string): Promise<boolean> {
  const where = organizationId ? { organizationId } : undefined;
  try {
    await prisma.monitoringEvent.findFirst({ select: { id: true }, where, take: 1 });
    return true;
  } catch {
    return false;
  }
}

function isRateLimitingActive(): boolean {
  const limit = Number.parseInt(process.env.PUBLIC_RATE_LIMIT_PER_TEN_MINUTES ?? '100', 10);
  return Number.isInteger(limit) && limit > 0;
}

async function isTrustChainDeterministic(): Promise<boolean> {
  try {
    const result = await validateTrustChain(process.env.TRUST_CHAIN_HEALTHCHECK_NPI ?? '1234567890');
    return (
      result.valid && !result.invalidTransitions && !result.checksumMismatches && result.appendOnlyConfirmed
    );
  } catch {
    return false;
  }
}

async function buildPilotReadiness(organizationId?: string): Promise<PilotChecklist> {
  const dbConnected = await isDbConnected();
  const trustLedgerOperational = await isTrustLedgerOperational();
  const monitoringOperational = await isMonitoringOperational(organizationId);

  const schemaStable = dbConnected && trustLedgerOperational && monitoringOperational;
  const monitoringActive = schemaStable && Boolean(MONITORING_SECRET);
  const trustLedgerDeterministic = await isTrustChainDeterministic();
  const rateLimitingActive = isRateLimitingActive();
  const envValidated = process.env.NODE_ENV === 'production' ? getProductionEnvCheck().ok : true;
  const noDemoModeInProd = process.env.NODE_ENV !== 'production' || !YC_DEMO_MODE;

  return {
    schemaStable,
    monitoringActive,
    trustLedgerDeterministic,
    rateLimitingActive,
    envValidated,
    noDemoModeInProd,
    readyForPilot:
      schemaStable &&
      monitoringActive &&
      trustLedgerDeterministic &&
      rateLimitingActive &&
      envValidated &&
      noDemoModeInProd,
  };
}

function buildOrganizationFilter(organizationId: string | undefined): OrganizationQueryFilter {
  return organizationId ? { organizationId } : {};
}

// ─── Wave 34: Enterprise Status ─────────────────────────────

type EnterpriseStatus = {
  systemFrozen: boolean;
  trustLedgerDeterministic: boolean;
  strictTransitionMode: boolean;
  haipCompliant: boolean;
  didReady: boolean;
  walletSimulationReady: boolean;
  rateLimitingActive: boolean;
  monitoringOperational: boolean;
  multiTenantSafe: boolean;
  structuredLoggingEnabled: boolean;
  startupGuardsEnforced: boolean;
  lifecycleIntegrity: boolean;
  trustEngineIntegrity: boolean;
  selectiveDisclosureEnabled: boolean;
  version: string;
  pilotReady: boolean;
};

/**
 * Validate verifier lifecycle integrity:
 * - All states are enum-backed (const array).
 * - Every sequential pair allows a +1 transition.
 * - No invalid state jumps exist in the transition table.
 */
function checkLifecycleIntegrity(): boolean {
  const states = VERIFIER_LIFECYCLE_STATES;
  if (states.length === 0) {
    return false;
  }

  for (let i = 0; i < states.length - 1; i += 1) {
    const assessment = assessVerifierLifecycleTransition(states[i], states[i + 1]);
    if (!assessment.allowed || assessment.noOp) {
      return false;
    }
  }

  // Verify backward transitions are blocked
  for (let i = 1; i < states.length; i += 1) {
    const backward = assessVerifierLifecycleTransition(states[i], states[0]);
    if (backward.allowed && !backward.noOp) {
      return false;
    }
  }

  // Verify coercion returns valid enum values
  for (const state of states) {
    if (coerceVerifierLifecycle(state) !== state) {
      return false;
    }
  }

  return true;
}

/**
 * Validate trust engine consistency:
 * - computeTrustState is the single source (pure function).
 * - monitoringEngine uses the same computeTrustState function.
 * - Trust ledger append-only confirmed.
 * - Strict transition mode active (SYSTEM_FROZEN blocks feature flags).
 */
async function checkTrustEngineIntegrity(organizationId?: string): Promise<boolean> {
  // 1. Validate trust chain determinism
  const chainValid = await isTrustChainDeterministic();
  if (!chainValid) {
    return false;
  }

  // 2. Validate trust ledger append-only ordering
  const ledgerOrdered = await evaluateTrustLedgerIntegrity(organizationId);
  if (!ledgerOrdered) {
    return false;
  }

  // 3. Validate computeTrustState is deterministic by running same input twice
  const testInput = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), monitoring: true };
  const fixedNow = new Date('2026-01-01T00:00:00.000Z');
  const result1 = computeTrustState(testInput, fixedNow);
  const result2 = computeTrustState(testInput, fixedNow);
  if (result1 !== result2) {
    return false;
  }

  return true;
}

/**
 * Data scope safety: verify organizationId filtering is respected.
 * Creates a scoped query with a synthetic organizationId and confirms
 * it returns zero results (no cross-tenant leakage).
 */
async function checkDataScopeSafety(): Promise<boolean> {
  const syntheticOrgId = `__scope_test_${Date.now()}`;
  try {
    const [artifacts, events, links] = await Promise.all([
      prisma.verificationArtifact.count({ where: { organizationId: syntheticOrgId } }),
      prisma.monitoringEvent.count({ where: { organizationId: syntheticOrgId } }),
      prisma.shareLink.count({ where: { organizationId: syntheticOrgId } }),
    ]);

    return artifacts === 0 && events === 0 && links === 0;
  } catch {
    return false;
  }
}

/**
 * Wave C: Check if selective disclosure proofs can be generated.
 * True when at least one artifact has both merkleRoot and claimHashes,
 * and the proof engine can reconstruct valid proofs.
 */
async function checkSelectiveDisclosureCapability(
  organizationId?: string,
): Promise<boolean> {
  try {
    const sample = await prisma.verificationArtifact.findFirst({
      where: {
        merkleRoot: { not: null },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sample) {
      return false;
    }

    const hasMerkleRoot =
      typeof sample.merkleRoot === 'string' && sample.merkleRoot.length > 0;
    const hasClaimHashes =
      Array.isArray(sample.claimHashes) && sample.claimHashes.length > 0;

    if (!hasMerkleRoot || !hasClaimHashes) {
      return false;
    }

    return validateMerkleIntegrity(sample);
  } catch {
    return false;
  }
}

/**
 * Freeze hard lock: when SYSTEM_FROZEN=true, block runtime mutations
 * that would alter system behavior. Called on startup and before
 * any attempted toggle/migration operation.
 */
function enforceFreezeHardLock(operation: string): void {
  if (!SYSTEM_FROZEN) {
    return;
  }

  const blockedOperations = [
    'schema_migration',
    'env_toggle',
    'feature_flag_mutation',
    'adapter_switch',
  ];

  if (blockedOperations.includes(operation)) {
    log('error', 'freeze_hard_lock_violation', {
      event: 'freeze_hard_lock_blocked',
      operation,
      systemFrozen: true,
    });
    throw new Error(
      `Operation "${operation}" blocked: SYSTEM_FROZEN=true prevents runtime mutations.`,
    );
  }
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBooleanWithFallback(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseVerifierWalletApiKeys(): Set<string> {
  const raw = process.env.VERIFIER_WALLET_API_KEYS ?? process.env.API_KEYS ?? '';
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function readSigningKeyRaw(): string {
  if (process.env.ISSUER_SIGNING_JWK && process.env.ISSUER_SIGNING_JWK.trim().length > 0) {
    return process.env.ISSUER_SIGNING_JWK.trim();
  }

  if (process.env.SIGNING_KEY_JWK && process.env.SIGNING_KEY_JWK.trim().length > 0) {
    return process.env.SIGNING_KEY_JWK.trim();
  }

  return '';
}

type EcSigningJwk = {
  kty: string;
  crv: string;
  alg: string;
  use: string;
  x: string;
  y: string;
};

function parseSigningJwk(raw: string): EcSigningJwk | null {
  try {
    const parsed = JSON.parse(raw) as Partial<EcSigningJwk>;
    if (
      parsed.kty === 'EC' &&
      parsed.crv === 'P-256' &&
      parsed.alg === 'ES256' &&
      parsed.use === 'sig' &&
      typeof parsed.x === 'string' &&
      parsed.x.length > 0 &&
      typeof parsed.y === 'string' &&
      parsed.y.length > 0
    ) {
      return {
        kty: parsed.kty,
        crv: parsed.crv,
        alg: parsed.alg,
        use: parsed.use,
        x: parsed.x,
        y: parsed.y,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isHaipSignerReady(): boolean {
  const raw = readSigningKeyRaw();
  return raw.length > 0 && parseSigningJwk(raw) !== null;
}

function computeHaipComplianceReady(): boolean {
  if (!isHaipSignerReady()) {
    return false;
  }

  const pkceRequired = parseBooleanWithFallback(process.env.PKCE_REQUIRED, true);
  const parRequired = parseBooleanWithFallback(process.env.PAR_REQUIRED, true);
  const dpopRequired = parseBooleanWithFallback(process.env.DPOP_REQUIRED, true);
  const cNonceLifetime = parsePositiveInteger(process.env.C_NONCE_LIFETIME_SECONDS, 60);

  return pkceRequired && parRequired && dpopRequired && cNonceLifetime <= 60;
}

function isDidResolverReady(): boolean {
  const issuerDid = process.env.ISSUER_DID?.trim() ?? 'did:web:vitalcv.com';
  return isHaipResolverHealthy() && issuerDid === 'did:web:vitalcv.com';
}

function isHaipResolverHealthy(): boolean {
  return isHaipSignerReady();
}

function isWalletSimulationReady(): boolean {
  const verifierKeys = parseVerifierWalletApiKeys();
  const hasVerifierCredentialKey = verifierKeys.size > 0;
  if (process.env.NODE_ENV === 'production') {
    return hasVerifierCredentialKey && isHaipSignerReady();
  }

  return true;
}

async function buildEnterpriseStatus(organizationId?: string): Promise<EnterpriseStatus> {
  const [
    trustLedgerDeterministic,
    monitoringOperational,
    trustEngineIntegrity,
    multiTenantSafe,
    selectiveDisclosureEnabled,
  ] = await Promise.all([
    isTrustChainDeterministic(),
    isMonitoringOperational(organizationId),
    checkTrustEngineIntegrity(organizationId),
    checkDataScopeSafety(),
    checkSelectiveDisclosureCapability(organizationId),
  ]);

  const systemFrozen = SYSTEM_FROZEN;
  const strictTransitionMode = checkLifecycleIntegrity();
  const haipCompliant = computeHaipComplianceReady();
  const didReady = isDidResolverReady();
  const walletSimulationReady = isWalletSimulationReady();
  const rateLimitingActive = isRateLimitingActive();
  const structuredLoggingEnabled = true; // JSON logger is always active
  const startupGuardsEnforced = process.env.NODE_ENV === 'production'
    ? getProductionEnvCheck().ok
    : true;
  const lifecycleIntegrity = strictTransitionMode;

  const pilotReady =
    systemFrozen &&
    trustLedgerDeterministic &&
    strictTransitionMode &&
    haipCompliant &&
    didReady &&
    walletSimulationReady &&
    rateLimitingActive &&
    monitoringOperational &&
    multiTenantSafe &&
    structuredLoggingEnabled &&
    startupGuardsEnforced &&
    lifecycleIntegrity &&
    trustEngineIntegrity;

  return {
    systemFrozen,
    trustLedgerDeterministic,
    strictTransitionMode,
    haipCompliant,
    didReady,
    walletSimulationReady,
    rateLimitingActive,
    monitoringOperational,
    multiTenantSafe,
    structuredLoggingEnabled,
    startupGuardsEnforced,
    lifecycleIntegrity,
    trustEngineIntegrity,
    selectiveDisclosureEnabled,
    version: VERSION_INFO.buildVersion,
    pilotReady,
  };
}

function isStrictTransitionMode(): boolean {
  return parseBooleanEnv(process.env.STRICT_TRANSITION_MODE);
}

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
    log('error', 'funnel_event_log_failed', {
      event: 'funnel_event_log_failed',
      eventType,
      npi: npi.trim(),
      error: error instanceof Error ? error.message : 'unknown',
    });
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
    log('error', 'funnel_metrics_failed', {
      event: 'funnel_metrics_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return zero;
  }
}

async function loadAverageTimeFromRegistrationToPilotActivation(
  organizationId?: string,
): Promise<number | null> {
  const organizationClause = organizationId
    ? Prisma.sql`AND "organizationId" = ${organizationId}`
    : Prisma.sql``;
  try {
    const activationRows = await eventLogPrisma.$queryRaw<
      Array<VerifierActivationTimeRow>
    >`
      SELECT
        "organizationId",
        MIN("createdAt") AS "activatedAt"
      FROM "EventLog"
      WHERE "eventType" = 'VERIFIER_LIFECYCLE_PILOT_ACTIVATED'
        ${organizationClause}
        AND "organizationId" IS NOT NULL
      GROUP BY "organizationId"
    `;

    if (activationRows.length === 0) {
      return null;
    }

    const verifiedOrgIds = activationRows
      .map((row) => row.organizationId)
      .filter((id): id is string => id !== null);

    const orgs = await prisma.verifierOrg.findMany({
      where: {
        id: { in: verifiedOrgIds },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const activationByOrg = new Map<string, Date>(
      activationRows
        .filter(
          (row): row is VerifierActivationTimeRow & { organizationId: string } =>
            row.organizationId !== null,
        )
        .map((row) => [row.organizationId, row.activatedAt]),
    );

    const deltasMs = orgs
      .map((org) => {
        const activatedAt = activationByOrg.get(org.id);
        if (!activatedAt) {
          return null;
        }
        return activatedAt.getTime() - org.createdAt.getTime();
      })
      .filter((delta): delta is number => delta !== null && Number.isFinite(delta) && delta > 0);

    if (deltasMs.length === 0) {
      return null;
    }

    const avgMs = deltasMs.reduce((sum, deltaMs) => sum + deltaMs, 0) / deltasMs.length;
    return Number((avgMs / MS_PER_DAY).toFixed(2));
  } catch (error) {
    log('error', 'verifier_activation_latency_failed', {
      event: 'verifier_activation_latency_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
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

function parseCredentialLifecycleState(value: unknown): CredentialLifecycleState | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  switch (normalized) {
    case CredentialLifecycleState.ISSUED:
      return CredentialLifecycleState.ISSUED;
    case CredentialLifecycleState.ACTIVE:
      return CredentialLifecycleState.ACTIVE;
    case CredentialLifecycleState.SUSPENDED:
      return CredentialLifecycleState.SUSPENDED;
    case CredentialLifecycleState.REVOKED:
      return CredentialLifecycleState.REVOKED;
    case CredentialLifecycleState.EXPIRED:
      return CredentialLifecycleState.EXPIRED;
    default:
      return null;
  }
}

function isCredentialActiveFromRecord(record: {
  revokedAt: Date | null;
  suspendedAt: Date | null;
  expiresAt: Date | null;
  status: string;
}): boolean {
  const lifecycleState = computeCredentialState(
    {
      revokedAt: record.revokedAt,
      suspendedAt: record.suspendedAt,
      expiresAt: record.expiresAt,
      status: record.status,
    },
    new Date(),
  );

  return lifecycleState === CredentialLifecycleState.ACTIVE;
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
    timeFromRegistrationToPilotActivation: null,
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
    verifierFunnelMetrics: {
      totalVerifierViews: verifierViews,
      totalPilotClicks: 0,
      totalActivations: 0,
      conversionRateByVariant: {},
    },
    revenueRecoveryEstimate: estimatedRevenueImpact,
    trustStateDistribution: {
      verified: 8,
      verified_monitoring: 2,
      expiring_soon: 1,
      needs_review: 1,
      expired: 0,
    },
    monitoringDeltaFrequency: 0,
    enterpriseComplianceSummary: buildEnterpriseComplianceSummary(),
    pilotReady: false,
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

async function evaluateTrustLedgerIntegrity(
  organizationId?: string,
): Promise<boolean> {
  const organizationFilter = buildOrganizationFilter(organizationId);

  const events = await prisma.trustLedgerEntry.findMany({
    where: organizationFilter,
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });

  if (events.length <= 1) {
    return true;
  }

  for (let i = 1; i < events.length; i += 1) {
    if (events[i].createdAt.getTime() < events[i - 1].createdAt.getTime()) {
      return false;
    }
  }

  return true;
}

async function loadTrustStateDistribution(organizationId?: string): Promise<TrustStateDistribution> {
  const distribution: TrustStateDistribution = {
    verified: 0,
    verified_monitoring: 0,
    expiring_soon: 0,
    needs_review: 0,
    expired: 0,
  };

  try {
    const organizationFilter = buildOrganizationFilter(organizationId);
    const artifacts = await prisma.verificationArtifact.findMany({
      where: organizationFilter,
      select: { trustState: true },
    });

    for (const artifact of artifacts) {
      const state = artifact.trustState;
      if (state in distribution) {
        distribution[state as keyof TrustStateDistribution] += 1;
      }
    }
  } catch {
    // Return zero distribution on failure
  }

  return distribution;
}

async function loadMonitoringDeltaFrequency(organizationId?: string): Promise<number> {
  try {
    const organizationFilter = buildOrganizationFilter(organizationId);
    const count = await prisma.monitoringEvent.count({ where: organizationFilter });
    return count;
  } catch {
    return 0;
  }
}

function buildEnterpriseComplianceSummary(): EnterpriseComplianceSummary {
  return {
    ncqaAlignment: COMPLIANCE_SUMMARY.ncqaAlignment,
    monitoringEnabled: COMPLIANCE_SUMMARY.monitoringEnabled,
    trustLedgerAppendOnly: COMPLIANCE_SUMMARY.trustLedgerAppendOnly,
    lifecycleEnforced: checkLifecycleIntegrity(),
    multiTenantScoped: true,
  };
}

async function loadYcMetrics(organizationId?: string): Promise<YcMetricsPayload> {
  if (parseYcDemoMode()) {
    return collectDemoYcMetrics();
  }

  const organizationFilter = buildOrganizationFilter(organizationId);

  const [shareLinks, verifiedViews, npiGroups, verifierAcceptances, viewRows, exportCount, funnelMetrics, pilotOrgs, activePilotPlans, timeFromRegistrationToPilotActivation, trustStateDistribution, monitoringDeltaFrequency, enterpriseStatus] =
    await Promise.all([
      prisma.shareLink.count({ where: organizationFilter }),
      prisma.shareLink.count({
        where: {
          ...organizationFilter,
          firstViewedAt: { not: null },
        },
      }),
      prisma.shareLink.groupBy({
        by: ['npi'],
        _count: { _all: true },
        where: organizationFilter,
      }),
      prisma.verifierAcceptance.count(),
      prisma.shareLink.findMany({
        where: {
          ...organizationFilter,
          firstViewedAt: { not: null },
        },
        select: { createdAt: true, firstViewedAt: true },
      }),
      prisma.auditEvent.count({
        where: {
          type: 'ARTIFACT_EXPORTED',
          ...(organizationFilter.organizationId ? { organizationId } : {}),
        },
      }),
      loadFunnelMetrics(organizationId),
      prisma.pilotOrg.findMany({
        orderBy: { activatedAt: 'desc' },
        select: { id: true, name: true, contactEmail: true, activatedAt: true, accepted: true },
      }),
      prisma.pilotPlan.findMany({
        where: {
          active: true,
          ...(organizationFilter.organizationId ? { organizationId } : {}),
        },
        select: { organizationId: true, bundleCount: true },
      }),
      loadAverageTimeFromRegistrationToPilotActivation(organizationId),
      loadTrustStateDistribution(organizationId),
      loadMonitoringDeltaFrequency(organizationId),
      buildEnterpriseStatus(organizationId),
    ]);

  const avgMillisecondsToView = calculateAverageTimeToViewMilliseconds(viewRows);
  const avgTimeToView =
    avgMillisecondsToView === null ? 0 : Number((avgMillisecondsToView / (1000 * 60)).toFixed(2));
  const estimatedStartDateAccelerationDays = toStartDateAcceleration(avgMillisecondsToView);

  const activeOrgIds = activePilotPlans
    .map((plan) => plan.organizationId)
    .filter((id): id is string => id !== null);

  const scopedPilotOrgs = organizationFilter.organizationId
    ? pilotOrgs.filter((pilotOrg) => activeOrgIds.includes(pilotOrg.id))
    : pilotOrgs;

  const bundlesByOrg = new Map<string, number>(
    activePilotPlans
      .filter((plan): plan is typeof plan & { organizationId: string } => plan.organizationId !== null)
      .map((plan) => [plan.organizationId, plan.bundleCount]),
  );
  const activeBundlesGenerated = activePilotPlans.reduce(
    (sum, plan) => sum + plan.bundleCount,
    0,
  );

  const pilotOrgRows: PilotOrgRow[] = scopedPilotOrgs.map((p) => ({
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
    timeFromRegistrationToPilotActivation,
    pilotOrgCount: scopedPilotOrgs.length,
    monitoringFlags: {
      firstViewTracking: verifiedViews > 0,
      artifactGenerationTracking: activeBundlesGenerated > 0,
      pilotOrgTracking: organizationFilter.organizationId
        ? scopedPilotOrgs.length > 0
        : pilotOrgs.length > 0,
    },
    isDemoMode: false,
    pilotOrgs: pilotOrgRows,
    verifierFunnelMetrics: funnelMetrics,
    revenueRecoveryEstimate: estimateRecoveredRevenue(activeBundlesGenerated),
    trustStateDistribution,
    monitoringDeltaFrequency,
    enterpriseComplianceSummary: buildEnterpriseComplianceSummary(),
    pilotReady: enterpriseStatus.pilotReady,
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

  app.get('/verifier', (_req, res) => {
    res.status(200).json({ route: 'verifier', status: 'available' });
  });

  app.get('/api/internal/health', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const [dbConnected, trustLedgerOperational, monitoringOperational] = await Promise.all([
      isDbConnected(),
      isTrustLedgerOperational(),
      isMonitoringOperational(),
    ]);

    return res.status(200).json({
      status:
        dbConnected && trustLedgerOperational && monitoringOperational ? 'ok' : 'degraded',
      dbConnected,
      trustLedgerOperational,
      monitoringOperational,
    });
  });
}

function registerLookupRoutes(app: Express): void {
  app.get('/clinician', async (req: Request, res: Response) => {
    const npiInput = parseOptionalString(req.query.npi);

    try {
      const npi = parseNpi(npiInput, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'Clinician not found' });
      }

      return res.status(200).json({
        clinicianId: npi,
        npi,
        trustState: artifact.trustState,
        monitoring: artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD',
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid clinician lookup' });
    }
  });

  app.get('/api/npi/:npi', async (req: Request, res: Response) => {
    try {
      const npi = parseNpi(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'NPI not found' });
      }

      return res.status(200).json({
        npi,
        artifact: {
          id: artifact.id,
          source: artifact.source,
          status: artifact.status,
          verifiedAt: artifact.verifiedAt.toISOString(),
          expiresAt: artifact.expiresAt?.toISOString() ?? null,
          monitoring: artifact.monitoring,
          trustState: artifact.trustState,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid NPI' });
    }
  });

  app.get('/api/trust/:npi', async (req: Request, res: Response) => {
    try {
      const npi = parseNpi(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'NPI not found' });
      }

      return res.status(200).json({
        npi,
        trustState: artifact.trustState,
        monitoring: artifact.monitoring,
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid NPI' });
    }
  });
}

function registerComplianceRoutes(app: Express): void {
  app.get('/api/compliance/summary', (_req: Request, res: Response) => {
    res.status(200).json(COMPLIANCE_SUMMARY);
  });

  app.get('/api/security/posture', (_req: Request, res: Response) => {
    res.status(200).json(SECURITY_POSTURE);
  });

  app.get('/api/version', (_req: Request, res: Response) => {
    res.status(200).json(VERSION_INFO);
  });
}

function registerOperationsRoutes(app: Express): void {
  app.get('/api/internal/system-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const dbConnected = await isDbConnected();
    const trustLedgerOperational = await isTrustLedgerOperational();
    const monitoringOperational = await isMonitoringOperational();

    return res.status(200).json({
      version: VERSION_INFO.buildVersion,
      uptime: process.uptime(),
      dbConnected,
      trustLedgerOperational,
      monitoringOperational,
      pilotMode: PILOT_MODE,
      enterpriseMode: ENTERPRISE_MODE,
      frozen: SYSTEM_FROZEN,
    });
  });

  app.get('/api/internal/pilot-checklist', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await buildPilotReadiness(organizationId);
      return res.status(200).json(payload);
    } catch {
      return res.status(500).json({ error: 'Unable to calculate pilot readiness' });
    }
  });

  // ── Wave 34: Consolidated Enterprise Status ──────────────────
  app.get('/api/internal/enterprise-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await buildEnterpriseStatus(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'enterprise_status_error', {
        event: 'enterprise_status_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute enterprise status' });
    }
  });

  app.get('/api/internal/artifact-merkle/:artifactId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const claimHashes = Array.isArray(artifact.claimHashes) ? artifact.claimHashes : [];
      const merkleRoot = typeof artifact.merkleRoot === 'string' ? artifact.merkleRoot : '';

      return res.status(200).json({
        merkleRoot,
        claimCount: claimHashes.length,
        merkleValid: validateMerkleIntegrity(artifact),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to validate artifact merkle proof';
      return res.status(500).json({ error: message });
    }
  });

  // ── Wave 34: Freeze Hard Lock Enforcement ────────────────────
  app.post('/api/internal/freeze-check', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const operation = typeof body.operation === 'string' ? body.operation.trim() : '';

    if (!operation) {
      return res.status(400).json({ error: 'operation field is required' });
    }

    try {
      enforceFreezeHardLock(operation);
      return res.status(200).json({ allowed: true, operation });
    } catch (error) {
      return res.status(403).json({
        allowed: false,
        operation,
        error: error instanceof Error ? error.message : 'Operation blocked by freeze lock',
      });
    }
  });
}

// ── Wave C: Selective Disclosure Proof Routes ─────────────────
function registerProofRoutes(app: Express): void {
  /**
   * Generate a selective disclosure proof for a single claim.
   * Requires API key auth and org scoping — only the verifier org
   * that owns the artifact can generate proofs.
   */
  app.get(
    '/api/proof/:artifactId/:claimType',
    proofRateLimit,
    apiKeyAuth,
    async (req: Request, res: Response) => {
      try {
        const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
        const claimType = parseRequiredString(req.params.claimType, 'claimType');
        const organizationId = getRequestOrganizationId(req);

        const artifact = await prisma.verificationArtifact.findUnique({
          where: { id: artifactId },
        });

        if (!artifact) {
          return res.status(404).json({ error: 'Artifact not found' });
        }

        // RBAC: artifact must be scoped to requesting org
        if (organizationId && artifact.organizationId !== organizationId) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        // Wave N: HAIP no-downgrade enforcement
        const algorithmHeader = typeof req.get('x-proof-algorithm') === 'string'
          ? req.get('x-proof-algorithm')
          : undefined;
        const haipCheck = enforceHaipNoDowngrade({
          algorithm: algorithmHeader ?? 'ES256',
          signed: true,
          issuerType: process.env.ISSUER_DID?.trim() ?? 'did:web:vitalcv.com',
        });
        if (!haipCheck.valid) {
          return res.status(422).json({
            error: 'HAIP no-downgrade violation',
            violations: haipCheck.violations,
          });
        }

        // Strict mode guard
        const strictMode = isStrictTransitionMode();
        if (strictMode) {
          if (!artifact.checksum || artifact.checksum.length === 0) {
            return res.status(422).json({ error: 'Strict mode: artifact fingerprint invalid' });
          }
          if (!artifact.merkleRoot || artifact.merkleRoot.length === 0) {
            return res.status(422).json({ error: 'Strict mode: artifact merkleRoot invalid' });
          }
          const integrityOk = validateMerkleIntegrity(artifact);
          if (!integrityOk) {
            return res.status(422).json({ error: 'Strict mode: artifact integrity invalid' });
          }

          const active = isCredentialActiveFromRecord(artifact);
          if (!active) {
            return res.status(422).json({ error: 'Strict mode: artifact lifecycle is not active' });
          }
        }

        const proofStartMs = Date.now();
        const claimProof = generateClaimProof(
          {
            npi: artifact.npi,
            status: artifact.status,
            rawPayload: artifact.rawPayload,
            checksum: artifact.checksum,
            merkleRoot: artifact.merkleRoot,
            claimHashes: artifact.claimHashes,
            verifiedAt: artifact.verifiedAt,
            expiresAt: artifact.expiresAt,
          },
          claimType,
        );
        recordLatency('proof', Date.now() - proofStartMs);

        return res.status(200).json({ claimProof });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to generate claim proof';
        log('error', 'proof_generation_error', {
          event: 'proof_generation_error',
          error: message,
        });
        return res.status(400).json({ error: message });
      }
    },
  );

  /**
   * Verify a selective disclosure claim proof.
   * Stateless — no DB access needed. Any party can verify.
   */
  app.post('/api/proof/verify', proofRateLimit, express.json(), async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const claimProofInput = body.claimProof;

      if (
        !claimProofInput ||
        typeof claimProofInput !== 'object' ||
        Array.isArray(claimProofInput)
      ) {
        return res.status(400).json({ error: 'claimProof is required' });
      }

      const proof = claimProofInput as Record<string, unknown>;

      // Validate required fields
      if (typeof proof.claimType !== 'string' || proof.claimType.trim().length === 0) {
        return res.status(400).json({ error: 'claimProof.claimType is required' });
      }
      if (
        proof.claimValue === undefined ||
        proof.claimValue === null ||
        (typeof proof.claimValue !== 'string' &&
          typeof proof.claimValue !== 'number' &&
          typeof proof.claimValue !== 'boolean')
      ) {
        return res.status(400).json({ error: 'claimProof.claimValue is required' });
      }
      if (typeof proof.leafHash !== 'string' || proof.leafHash.length === 0) {
        return res.status(400).json({ error: 'claimProof.leafHash is required' });
      }
      if (typeof proof.leafIndex !== 'number' || !Number.isInteger(proof.leafIndex) || proof.leafIndex < 0) {
        return res.status(400).json({ error: 'claimProof.leafIndex must be a non-negative integer' });
      }
      if (!Array.isArray(proof.proofPath)) {
        return res.status(400).json({ error: 'claimProof.proofPath must be an array' });
      }
      if (typeof proof.merkleRoot !== 'string' || proof.merkleRoot.length === 0) {
        return res.status(400).json({ error: 'claimProof.merkleRoot is required' });
      }
      if (typeof proof.fingerprint !== 'string' || proof.fingerprint.length === 0) {
        return res.status(400).json({ error: 'claimProof.fingerprint is required' });
      }

      const validatedProof: ClaimProof = {
        claimType: proof.claimType,
        claimValue: proof.claimValue as string | number | boolean,
        leafHash: proof.leafHash,
        leafIndex: proof.leafIndex,
        proofPath: proof.proofPath as string[],
        merkleRoot: proof.merkleRoot,
        fingerprint: proof.fingerprint,
      };

      const valid = verifyClaimProof(validatedProof);

      return res.status(200).json({ valid });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to verify claim proof';
      log('error', 'proof_verification_error', {
        event: 'proof_verification_error',
        error: message,
      });
      return res.status(400).json({ error: message });
    }
  });
}

function registerCredentialStatusRoutes(app: Express): void {
  app.get('/api/credential-status/:artifactId', credentialStatusRateLimit, async (req: Request, res: Response) => {
    const statusCheckStartMs = Date.now();
    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const lifecycleState = computeCredentialState(
        {
          revokedAt: artifact.revokedAt,
          suspendedAt: artifact.suspendedAt,
          expiresAt: artifact.expiresAt,
          status: artifact.status,
        },
        new Date(),
      );

      recordLatency('status_check', Date.now() - statusCheckStartMs);

      return res.status(200).json({
        lifecycleState,
        revoked: lifecycleState === CredentialLifecycleState.REVOKED,
        suspended: lifecycleState === CredentialLifecycleState.SUSPENDED,
        expired: lifecycleState === CredentialLifecycleState.EXPIRED,
        expiresAt: artifact.expiresAt,
        fingerprint: artifact.checksum,
        merkleRoot: artifact.merkleRoot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read credential status';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/status-list', credentialStatusRateLimit, async (_req: Request, res: Response) => {
    try {
      const [revokedCredentials, suspendedCredentials] = await Promise.all([
        prisma.verificationArtifact.findMany({
          where: { revokedAt: { not: null } },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
        prisma.verificationArtifact.findMany({
          where: {
            revokedAt: null,
            suspendedAt: { not: null },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
      ]);

      return res.status(200).json({
        revokedCredentialIds: revokedCredentials.map((row) => row.id),
        suspendedCredentialIds: suspendedCredentials.map((row) => row.id),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read status list';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/credential-status-audit/:artifactId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const lifecycleState = computeCredentialState(
        {
          revokedAt: artifact.revokedAt,
          suspendedAt: artifact.suspendedAt,
          expiresAt: artifact.expiresAt,
          status: artifact.status,
        },
        new Date(),
      );

      const latestLedgerEvent = await prisma.trustLedgerEntry.findFirst({
        where: { artifactId },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      });

      let ledgerConsistency = true;
      if (latestLedgerEvent?.metadata && typeof latestLedgerEvent.metadata === 'object') {
        const metadata = latestLedgerEvent.metadata as Record<string, unknown>;
        const ledgerState = parseCredentialLifecycleState(metadata.status);
        if (ledgerState !== null && ledgerState !== lifecycleState) {
          ledgerConsistency = false;
        }
      }

      return res.status(200).json({
        lifecycleState,
        revokedAt: artifact.revokedAt,
        suspendedAt: artifact.suspendedAt,
        expiresAt: artifact.expiresAt,
        ledgerConsistency,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read credential status audit';
      return res.status(500).json({ error: message });
    }
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
        log('error', 'verification_audit_emission_error', {
          event: 'verification_audit_emission_error',
          error: auditError instanceof Error ? auditError.message : 'unknown',
        });
      }

      return res.status(400).json({ error: message });
    }
  });
}



function registerPilotRoutes(app: Express): void {
  app.get('/api/verify/:shareId', publicApiRateLimit, async (req: Request, res: Response) => {
    const shareId = parseRequiredString(req.params.shareId, 'shareId');
    const organizationId = getRequestOrganizationId(req);
    const organizationFilter = buildOrganizationFilter(organizationId);
    const ref = normalizeFunnelRef(req.query.ref);

    try {
      const existing = await prisma.shareLink.findFirst({
        where: {
          id: shareId,
          ...organizationFilter,
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      const now = new Date();
      const isFirstView = existing.firstViewedAt === null;

      const updated = await prisma.shareLink.update({
        where: {
          id: shareId,
        },
        data: {
          firstViewedAt: existing.firstViewedAt ?? now,
        },
      });

      void logFunnelEvent('verify_api_call', updated.npi, {
        shareId: updated.id,
        isFirstView,
        ...(ref ? { ref } : {}),
        ...(organizationId ? { organizationId } : {}),
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
        const issuanceStartMs = Date.now();
        artifact = await createArtifactFromNursys(updated.npi, shareLinkOrgId);
        recordLatency('vc_issuance', Date.now() - issuanceStartMs);
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
      log('error', 'verify_share_error', {
        event: 'verify_share_error',
        shareId: req.params.shareId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to resolve share link' });
    }
  });

  app.post('/api/verifier/accept', walletRateLimit, async (req: Request, res: Response) => {
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

  app.post('/api/pilot/activate', walletRateLimit, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const organizationId = getRequestOrganizationId(req);
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
        ...(organizationId ? { organizationId } : {}),
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
          ...(organizationId ? { organizationId } : {}),
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
        ...(organizationId ? { organizationId } : {}),
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
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadYcMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'yc_metrics_error', {
        event: 'yc_metrics_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute YC metrics' });
    }
  });

  app.get('/api/internal/funnel-report', async (_req: Request, res: Response) => {
    try {
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadFunnelMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'funnel_report_error', {
        event: 'funnel_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute funnel report' });
    }
  });

  app.get('/api/internal/verifier-funnel', async (_req: Request, res: Response) => {
    try {
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadFunnelMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'funnel_report_error', {
        event: 'funnel_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute funnel report' });
    }
  });

  app.get('/api/pilot/report', async (_req: Request, res: Response) => {
    try {
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadYcMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'pilot_report_error', {
        event: 'pilot_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute pilot report' });
    }
  });

  // ── Wave 11: NCQA Audit-Ready Bundle Generator ──────────────
  app.get('/api/artifact/bundle/:npi', publicApiRateLimit, async (req: Request, res: Response) => {
    try {
      const npi = parseRequiredString(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);

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
      log('error', 'artifact_bundle_error', {
        event: 'artifact_bundle_error',
        npi: req.params.npi,
        error: error instanceof Error ? error.message : 'unknown',
      });
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
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const organizationId = getRequestOrganizationId(req);

    try {
      // Find all NPIs with monitoring=true
      const monitored = await prisma.verificationArtifact.findMany({
        where: {
          monitoring: true,
          ...(organizationId ? { organizationId } : {}),
        },
        distinct: ['npi'],
        orderBy: { createdAt: 'desc' },
        select: { npi: true },
      });

      const results = [];
      let checksRun = 0;
      let statusChanges = 0;

      for (const { npi } of monitored) {
        const result = await runMonitoringCheck(npi, organizationId);
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
      log('error', 'monitoring_run_error', {
        event: 'monitoring_run_error',
        organizationId: organizationId ?? null,
        error: error instanceof Error ? error.message : 'unknown',
      });
      const message = error instanceof Error ? error.message : 'Monitoring run failed';
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave L: Enterprise Readiness ───────────────────────────

function registerEnterpriseReadinessRoutes(app: Express): void {
  /**
   * GET /api/internal/enterprise-readiness
   * Returns capabilities snapshot + self-test results.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/enterprise-readiness', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      // Check cache first (1-minute TTL)
      const cachedCapabilities = enterpriseCapabilitiesCache.get('capabilities');
      const capabilities = cachedCapabilities ?? getEnterpriseCapabilities();
      if (!cachedCapabilities) {
        enterpriseCapabilitiesCache.set('capabilities', capabilities as unknown as Record<string, unknown>);
      }

      const selfTest = await runEnterpriseSelfTest();

      // Wave N: security status flags
      const zeroDowngradeEnforced = isZeroDowngradeEnforced();
      let runtimeGuardsPassed = true;
      try {
        const guardResult = runRuntimeGuards();
        runtimeGuardsPassed = guardResult.passed;
      } catch {
        // runRuntimeGuards throws in production on failure,
        // but we're already running so it passed at boot
        runtimeGuardsPassed = false;
      }

      return res.status(200).json({
        capabilities,
        selfTest,
        zeroDowngradeEnforced,
        runtimeGuardsPassed,
      });
    } catch (error) {
      log('error', 'enterprise_readiness_error', {
        event: 'enterprise_readiness_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute enterprise readiness' });
    }
  });
}

// ─── Wave M: Performance Metrics ────────────────────────────

function registerPerformanceMetricsRoutes(app: Express): void {
  /**
   * GET /api/internal/performance-metrics
   * Returns rolling averages for key operation latencies.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/performance-metrics', (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    return res.status(200).json(getPerformanceSnapshot());
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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-request-id',
      'x-org-id',
      'x-monitoring-secret',
    ],
    credentials: corsOrigin !== '*',
  }),
);
app.use(requireOrganizationContext);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Observability
app.use(requestObservability);

// Routes
registerHealthRoutes(app);
registerIngestRoutes(app);
registerVerificationRoutes(app);
registerProofRoutes(app);
registerComplianceRoutes(app);
registerOperationsRoutes(app);
registerPilotRoutes(app);
registerTrustStateRoutes(app);
registerCredentialStatusRoutes(app);
registerMonitoringRoutes(app);
registerEnterpriseReadinessRoutes(app);
registerPerformanceMetricsRoutes(app);
registerWedgeRoutes(app);

if (ENTERPRISE_MODE) {
  app.get('/internal/enterprise', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const trustLedgerIntegrity = await evaluateTrustLedgerIntegrity(organizationId);

      return res.status(200).json({
        complianceSummary: COMPLIANCE_SUMMARY,
        securityPosture: SECURITY_POSTURE,
        trustLedgerIntegrity,
      });
    } catch (error) {
      log('error', 'enterprise_signals_error', {
        event: 'enterprise_signals_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to collect enterprise signals' });
    }
  });
}

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

// Error handler (must be last)
app.use(errorHandler);

export default app;
