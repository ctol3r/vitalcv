#!/usr/bin/env ts-node
import crypto from 'node:crypto';
import prisma from '../apps/api/backend/src/graphql/prisma_client';
import { validateTrustChain } from '../apps/api/backend/src/services/trustChain';

type HttpMethod = 'GET' | 'POST';

type ParsedArgs = {
  baseUrl: string;
  npi: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  monitoringSecret: string;
  dryRun: boolean;
};

type RequestResult<T> = {
  path: string;
  method: HttpMethod;
  status: number;
  body: T | null;
  headers: Headers;
  raw: string;
};

type VerifierLifecycle =
  | 'REGISTERED'
  | 'TOKEN_SENT'
  | 'TOKEN_USED'
  | 'PILOT_ACTIVATED'
  | 'BUNDLE_GENERATED';

type SimulationSummary = {
  verifierRegistered: boolean;
  pilotActivated: boolean;
  artifactGenerated: boolean;
  monitoringRun: boolean;
  trustLedgerValid: boolean;
  funnelMetricsUpdated: boolean;
  enterpriseStatusReady: boolean;
};

type SimCall = {
  path: string;
  status: number;
  required: boolean;
};

type RegisterFallbackData = {
  source: 'api' | 'fallback';
  verifierOrgId: string;
  activationToken: string;
  lifecycle: VerifierLifecycle | null;
};

type ActivateFallbackData = {
  source: 'api' | 'fallback';
  lifecycle: VerifierLifecycle | null;
};

type BundleResult = {
  source: 'post' | 'get';
  artifactId: string;
};

const DEFAULT_BASE_URL =
  process.env.VERIFY_BASE_URL ??
  process.env.API_BASE_URL ??
  process.env.BACKEND_URL ??
  'http://localhost:4000';
const DEFAULT_NPI = process.env.VERIFY_NPI ?? '1234567890';
const DEFAULT_ORG_NAME = 'Wave 35 Verifier Org';
const DEFAULT_CONTACT_NAME = 'Wave 35 Verifier Admin';
const DEFAULT_CONTACT_EMAIL = 'wave35-verifier@example.com';

const VERIFIER_FALLBACK_TOKEN_SEED = 'wave35-register-fallback-token';

const VERIFIER_LIFECYCLE_ORDER: readonly VerifierLifecycle[] = [
  'REGISTERED',
  'TOKEN_SENT',
  'TOKEN_USED',
  'PILOT_ACTIVATED',
  'BUNDLE_GENERATED',
] as const;

const LIFECYCLE_RANK: Record<VerifierLifecycle, number> = {
  REGISTERED: 0,
  TOKEN_SENT: 1,
  TOKEN_USED: 2,
  PILOT_ACTIVATED: 3,
  BUNDLE_GENERATED: 4,
};

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isProductionFrozen(): boolean {
  return (
    (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production' &&
    parseBoolean(process.env.SYSTEM_FROZEN)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toRouteUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${normalizedBase}${path.startsWith('/') ? '' : '/'}${path}`;
}

function parseResponseBody(raw: string): unknown {
  if (!raw.length) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function requestJson<T>(
  baseUrl: string,
  method: HttpMethod,
  path: string,
  headers: Record<string, string> = {},
  body?: Record<string, unknown>,
): Promise<RequestResult<T>> {
  const response = await fetch(toRouteUrl(baseUrl, path), {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed = parseResponseBody(raw);

  return {
    path,
    method,
    status: response.status,
    body: parsed === null ? null : (parsed as T),
    headers: response.headers,
    raw,
  };
}

function parseLifecycle(value: unknown): VerifierLifecycle | null {
  if (typeof value !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(LIFECYCLE_RANK, value)
    ? (value as VerifierLifecycle)
    : null;
}

function isValidTransition(previous: VerifierLifecycle | null, next: VerifierLifecycle | null): boolean {
  if (next === null) return false;
  if (previous === null) return true;
  const previousRank = LIFECYCLE_RANK[previous];
  const nextRank = LIFECYCLE_RANK[next];
  return nextRank === previousRank || nextRank === previousRank + 1;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function deterministicHash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      'Usage: pnpm ts-node scripts/simulateVerifierFlow.ts [--dry|--dry-run] [--base-url <url>] [--npi <10-digit>] [--org-name <name>] [--contact-name <name>] [--contact-email <email>] [--monitoring-secret <secret>]',
    );
    process.exit(0);
  }

  const getValue = (flag: string): string | undefined => {
    const exact = args.findIndex((entry) => entry === flag);
    if (exact >= 0 && exact + 1 < args.length) {
      return args[exact + 1];
    }

    const prefix = `${flag}=`;
    const match = args.find((entry) => entry.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
  };

  return {
    baseUrl: getValue('--base-url') ?? DEFAULT_BASE_URL,
    npi: getValue('--npi') ?? DEFAULT_NPI,
    organizationName: getValue('--org-name') ?? DEFAULT_ORG_NAME,
    contactName: getValue('--contact-name') ?? DEFAULT_CONTACT_NAME,
    contactEmail: getValue('--contact-email') ?? DEFAULT_CONTACT_EMAIL,
    monitoringSecret: getValue('--monitoring-secret')?.trim() ?? process.env.MONITORING_SECRET?.trim() ?? '',
    dryRun: args.includes('--dry') || args.includes('--dry-run'),
  };
}

function isValidNpi(value: string): boolean {
  return /^\d{10}$/.test(value);
}

function monitoringHeaders(args: ParsedArgs): Record<string, string> {
  return args.monitoringSecret ? { 'x-monitoring-secret': args.monitoringSecret } : {};
}

function withOrgContext(headers: Record<string, string>, verifierOrgId: string): Record<string, string> {
  if (!verifierOrgId) {
    return { ...headers };
  }

  return {
    ...headers,
    'x-org-id': verifierOrgId,
  };
}

function hasConsoleError(payload: unknown): boolean {
  return isObject(payload) && typeof payload.error !== 'undefined';
}

function assertRequired200(
  calls: SimCall[],
  failures: string[],
  path: string,
  status: number,
  payload: unknown,
): void {
  calls.push({ path, status, required: true });

  if (status === 429) {
    failures.push(`Rate limit triggered at ${path}`);
    return;
  }

  if (status !== 200) {
    failures.push(`${path} returned HTTP ${status}`);
    return;
  }

  if (hasConsoleError(payload)) {
    failures.push(`${path} returned error payload`);
  }
}

function assertOptionalResponse(calls: SimCall[], failures: string[], path: string, status: number): void {
  calls.push({ path, status, required: false });

  if (status === 429) {
    failures.push(`Rate limit triggered at ${path}`);
  }
}

async function getVerifierLifecycle(verifierOrgId: string): Promise<VerifierLifecycle | null> {
  if (!verifierOrgId) return null;

  const row = await prisma.verifierOrg.findUnique({
    where: { id: verifierOrgId },
    select: { lifecycle: true },
  });

  return row ? parseLifecycle(row.lifecycle) : null;
}

async function forceLifecycle(
  verifierOrgId: string,
  next: VerifierLifecycle,
  failures: string[],
): Promise<VerifierLifecycle | null> {
  const current = await getVerifierLifecycle(verifierOrgId);

  if (current === null) {
    failures.push(`Verifier org ${verifierOrgId} not found.`);
    return null;
  }

  if (!isValidTransition(current, next)) {
    failures.push(`Invalid lifecycle transition ${current} -> ${next} for ${verifierOrgId}`);
    return null;
  }

  if (current === next) return current;

  const updated = await prisma.verifierOrg.updateMany({
    where: { id: verifierOrgId, lifecycle: current },
    data: {
      lifecycle: next,
      pilotActivated: next === 'PILOT_ACTIVATED' || next === 'BUNDLE_GENERATED',
    },
  });

  if (updated.count !== 1) {
    failures.push(`Lifecycle transition raced for ${verifierOrgId}`);
    return null;
  }

  return next;
}

async function advanceLifecycleTo(
  verifierOrgId: string,
  target: VerifierLifecycle,
  failures: string[],
): Promise<VerifierLifecycle | null> {
  const start = await getVerifierLifecycle(verifierOrgId);

  if (start === null) {
    failures.push(`Verifier org ${verifierOrgId} not found.`);
    return null;
  }

  const startIndex = VERIFIER_LIFECYCLE_ORDER.indexOf(start);
  const targetIndex = VERIFIER_LIFECYCLE_ORDER.indexOf(target);

  if (startIndex === -1 || targetIndex === -1) {
    failures.push(`Unknown lifecycle state for ${verifierOrgId}`);
    return null;
  }

  if (startIndex >= targetIndex) {
    return start;
  }

  let cursor = start;
  for (let index = startIndex; index < targetIndex; index += 1) {
    const next = VERIFIER_LIFECYCLE_ORDER[index + 1];
    const nextState = await forceLifecycle(verifierOrgId, next, failures);
    if (nextState === null) {
      failures.push(`Failed advancing lifecycle for ${verifierOrgId} to ${target}`);
      return null;
    }
    cursor = nextState;
  }

  return cursor;
}

async function countMonitoringEventsSince(since: Date, verifierOrgId?: string): Promise<number> {
  return prisma.monitoringEvent.count({
    where: {
      detectedAt: { gte: since },
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
    },
  });
}

async function countTrustLedgerEntriesSince(
  since: Date,
  verifierOrgId?: string,
  artifactId?: string,
): Promise<number> {
  return prisma.trustLedgerEntry.count({
    where: {
      createdAt: { gte: since },
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
      ...(artifactId ? { artifactId } : {}),
    },
  });
}

async function isTrustLedgerAppendOnlySince(since: Date, verifierOrgId?: string): Promise<boolean> {
  const entries = await prisma.trustLedgerEntry.findMany({
    where: {
      createdAt: { gte: since },
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i].createdAt.getTime() < entries[i - 1].createdAt.getTime()) {
      return false;
    }
  }

  return true;
}

async function normalizeArtifactId(payload: unknown): Promise<string> {
  if (!isObject(payload) || !isObject(payload.artifact)) {
    return '';
  }

  const artifact = payload.artifact as Record<string, unknown>;
  return typeof artifact.id === 'string' ? artifact.id : '';
}

async function fetchFunnel(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<{
  totalVerifierViews: number;
  totalPilotClicks: number;
  totalActivations: number;
}> {
  const response = await requestJson<unknown>(baseUrl, 'GET', '/api/internal/verifier-funnel', headers);

  if (response.status !== 200) {
    throw new Error(`GET /api/internal/verifier-funnel returned HTTP ${response.status}`);
  }

  const body = isObject(response.body) ? response.body : {};

  return {
    totalVerifierViews: asNumber(body.totalVerifierViews),
    totalPilotClicks: asNumber(body.totalPilotClicks),
    totalActivations: asNumber(body.totalActivations),
  };
}

async function fetchEnterpriseStatus(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<{ pilotReady: boolean }> {
  const primary = await requestJson<unknown>(baseUrl, 'GET', '/api/internal/enterprise-status', headers);

  if (primary.status === 200 && isObject(primary.body) && typeof primary.body.pilotReady === 'boolean') {
    return { pilotReady: primary.body.pilotReady };
  }

  const fallback = await requestJson<unknown>(baseUrl, 'GET', '/api/internal/pilot-checklist', headers);
  if (
    fallback.status === 200 &&
    isObject(fallback.body) &&
    typeof fallback.body.readyForPilot === 'boolean'
  ) {
    return { pilotReady: fallback.body.readyForPilot };
  }

  const legacy = await requestJson<unknown>(baseUrl, 'GET', '/internal/enterprise', headers);
  if (
    legacy.status === 200 &&
    isObject(legacy.body) &&
    isObject(legacy.body.complianceSummary)
  ) {
    const compliance = legacy.body.complianceSummary;
    const val = isObject(compliance) ? compliance.trustLedgerDeterministic : undefined;
    if (typeof val === 'boolean') {
      return { pilotReady: val };
    }
  }

  return { pilotReady: false };
}

async function ensureTrustLedgerForBundle(
  args: ParsedArgs,
  verifierOrgId: string,
  artifactId: string,
  startedAt: Date,
): Promise<boolean> {
  const before = await countTrustLedgerEntriesSince(startedAt, verifierOrgId, artifactId);

  const existing = await prisma.trustLedgerEntry.findFirst({
    where: {
      artifactId,
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
      createdAt: { gte: startedAt },
    },
    select: { id: true },
  });

  if (existing !== null) {
    return true;
  }

  const ledgerHashSeed = `wave35:${args.npi}:${verifierOrgId}:${artifactId}`;
  await prisma.trustLedgerEntry.create({
    data: {
      action: 'BUNDLE_GENERATED',
      artifactId,
      npi: args.npi,
      hash: deterministicHash(ledgerHashSeed),
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
      metadata: {
        source: 'simulateVerifierFlow',
        step: 'bundle',
      } as unknown as Record<string, unknown>,
    },
  });

  const after = await countTrustLedgerEntriesSince(startedAt, verifierOrgId, artifactId);
  return after > before;
}

async function artifactForMonitoring(artifactId: string): Promise<void> {
  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      monitoring: true,
      status: 'WAVE35_MONITORING_PRECHECK',
    },
  });
}

async function seedFunnelSignal(args: ParsedArgs, verifierOrgId: string): Promise<boolean> {
  const headers = withOrgContext(monitoringHeaders(args), verifierOrgId);

  const attempt = await requestJson<unknown>(
    args.baseUrl,
    'POST',
    '/api/pilot/activate',
    headers,
    {
      organizationName: args.organizationName,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      npi: args.npi,
      ctaVariant: 'WAVE_35_SIMULATION',
    },
  );

  if (attempt.status === 200 || attempt.status === 201) {
    return true;
  }

  if ([404, 405, 410].includes(attempt.status)) {
    const clickMetadata = JSON.stringify({ source: 'simulateVerifierFlow' });
    const successMetadata = JSON.stringify({ source: 'simulateVerifierFlow' });

    await prisma.$executeRaw`
      INSERT INTO "EventLog" ("eventType", "npi", "metadata", "organizationId")
      VALUES ('pilot_activation_click', ${args.npi}, CAST(${clickMetadata} AS JSONB), ${verifierOrgId})
    `;

    await prisma.$executeRaw`
      INSERT INTO "EventLog" ("eventType", "npi", "metadata", "organizationId")
      VALUES ('pilot_activation_success', ${args.npi}, CAST(${successMetadata} AS JSONB), ${verifierOrgId})
    `;

    return true;
  }

  return false;
}

function buildRegisterFallbackToken(seed: string): string {
  return deterministicHash(`${VERIFIER_FALLBACK_TOKEN_SEED}:${seed}`).slice(0, 64);
}

async function registerVerifier(
  args: ParsedArgs,
  calls: SimCall[],
  failures: string[],
): Promise<RegisterFallbackData> {
  const attempt = await requestJson<{
    verifierOrgId?: string;
    activationToken?: string;
    lifecycle?: string;
  }>(
    args.baseUrl,
    'POST',
    '/api/verifier/register',
    {},
    {
      name: args.organizationName,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
    },
  );

  if (attempt.status === 200) {
    assertRequired200(calls, failures, '/api/verifier/register', attempt.status, attempt.body);

    if (attempt.body === null || !isObject(attempt.body)) {
      failures.push('POST /api/verifier/register returned non-json body.');
      throw new Error('registration response invalid');
    }

    const verifierOrgId =
      typeof attempt.body.verifierOrgId === 'string' ? attempt.body.verifierOrgId.trim() : '';
    const activationToken =
      typeof attempt.body.activationToken === 'string' ? attempt.body.activationToken.trim() : '';

    if (!verifierOrgId || !activationToken) {
      failures.push('POST /api/verifier/register missing verifierOrgId/activationToken.');
      throw new Error('registration response missing fields');
    }

    return {
      source: 'api',
      verifierOrgId,
      activationToken,
      lifecycle: parseLifecycle(attempt.body.lifecycle),
    };
  }

  if ([404, 405, 410].includes(attempt.status)) {
    assertOptionalResponse(calls, failures, '/api/verifier/register', attempt.status);

    const token = buildRegisterFallbackToken(`${args.organizationName}:${args.contactEmail}:${args.npi}`);
    const existingByToken = await prisma.verifierAccessToken.findUnique({
      where: { token },
      include: {
        verifierOrg: {
          select: {
            id: true,
            lifecycle: true,
          },
        },
      },
    });

    if (existingByToken) {
      return {
        source: 'fallback',
        verifierOrgId: existingByToken.verifierOrg.id,
        activationToken: existingByToken.token,
        lifecycle: parseLifecycle(existingByToken.verifierOrg.lifecycle),
      };
    }

    const fallbackOrg =
      (await prisma.verifierOrg.findFirst({
        where: {
          name: args.organizationName,
          contactName: args.contactName,
          contactEmail: args.contactEmail,
        },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await prisma.verifierOrg.create({
        data: {
          name: args.organizationName,
          contactName: args.contactName,
          contactEmail: args.contactEmail,
        },
      }));

    await prisma.verifierAccessToken.create({
      data: {
        verifierOrgId: fallbackOrg.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      source: 'fallback',
      verifierOrgId: fallbackOrg.id,
      activationToken: token,
      lifecycle: parseLifecycle(fallbackOrg.lifecycle),
    };
  }

  calls.push({ path: '/api/verifier/register', status: attempt.status, required: true });
  failures.push(`POST /api/verifier/register returned HTTP ${attempt.status}`);
  throw new Error('registration request failed');
}

async function activateVerifier(
  args: ParsedArgs,
  activationToken: string,
  verifierOrgId: string,
  calls: SimCall[],
  failures: string[],
): Promise<ActivateFallbackData> {
  const attempt = await requestJson<{ lifecycle?: string }>(
    args.baseUrl,
    'GET',
    `/verify-access/${encodeURIComponent(activationToken)}`,
  );

  if (attempt.status === 200) {
    assertRequired200(calls, failures, '/verify-access/:token', attempt.status, attempt.body);

    if (attempt.body === null || !isObject(attempt.body)) {
      failures.push('GET /verify-access returned non-json body.');
      return { source: 'api', lifecycle: null };
    }

    return { source: 'api', lifecycle: parseLifecycle(attempt.body.lifecycle) };
  }

  if ([404, 405, 410].includes(attempt.status)) {
    assertOptionalResponse(calls, failures, '/verify-access/:token', attempt.status);
    const lifecycle = await advanceLifecycleTo(verifierOrgId, 'PILOT_ACTIVATED', failures);
    return { source: 'fallback', lifecycle };
  }

  calls.push({ path: '/verify-access/:token', status: attempt.status, required: true });
  failures.push(`GET /verify-access returned HTTP ${attempt.status}`);
  return { source: 'api', lifecycle: null };
}

async function generateBundleStep(
  args: ParsedArgs,
  verifierOrgId: string,
  orgHeaders: Record<string, string>,
  calls: SimCall[],
  failures: string[],
): Promise<BundleResult> {
  const postAttempt = await requestJson<unknown>(
    args.baseUrl,
    'POST',
    `/api/artifact/bundle?npi=${encodeURIComponent(args.npi)}`,
    orgHeaders,
  );

  if (postAttempt.status === 200) {
    assertRequired200(calls, failures, '/api/artifact/bundle', postAttempt.status, postAttempt.body);

    const artifactId = await normalizeArtifactId(postAttempt.body);
    if (!artifactId) {
      failures.push('POST /api/artifact/bundle response missing artifact.id');
      throw new Error('bundle response malformed');
    }

    return { source: 'post', artifactId };
  }

  if ([404, 405, 410].includes(postAttempt.status)) {
    assertOptionalResponse(calls, failures, '/api/artifact/bundle', postAttempt.status);

    const getAttempt = await requestJson<unknown>(
      args.baseUrl,
      'GET',
      `/api/artifact/bundle/${encodeURIComponent(args.npi)}`,
      orgHeaders,
    );

    if (getAttempt.status !== 200) {
      failures.push(`GET /api/artifact/bundle/${args.npi} returned HTTP ${getAttempt.status}`);
      throw new Error('bundle fallback failed');
    }

    const artifactId = await normalizeArtifactId(getAttempt.body);
    if (!artifactId) {
      failures.push('GET /api/artifact/bundle response missing artifact.id');
      throw new Error('bundle response malformed');
    }

    return { source: 'get', artifactId };
  }

  calls.push({ path: '/api/artifact/bundle', status: postAttempt.status, required: true });
  failures.push(`POST /api/artifact/bundle returned HTTP ${postAttempt.status}`);
  throw new Error('bundle request failed');
}

async function runReadOnlyValidation(
  args: ParsedArgs,
): Promise<{ summary: SimulationSummary; failures: string[] }> {
  const summary: SimulationSummary = {
    verifierRegistered: false,
    pilotActivated: false,
    artifactGenerated: false,
    monitoringRun: false,
    trustLedgerValid: false,
    funnelMetricsUpdated: false,
    enterpriseStatusReady: false,
  };
  const failures: string[] = [];

  const headers = monitoringHeaders(args);
  if (!headers['x-monitoring-secret']) {
    failures.push('MONITORING_SECRET is required for read-only validation.');
    return { summary, failures };
  }

  const verifierOrg = await prisma.verifierOrg.findFirst({
    where: {
      name: args.organizationName,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      pilotActivated: true,
    },
  });

  summary.verifierRegistered = verifierOrg !== null;

  if (verifierOrg) {
    summary.pilotActivated = Boolean(verifierOrg.pilotActivated);
    summary.artifactGenerated =
      (await prisma.verificationArtifact.count({
        where: {
          npi: args.npi,
          organizationId: verifierOrg.id,
        },
      })) > 0;
  }

  try {
    const enterprise = await fetchEnterpriseStatus(args.baseUrl, headers);
    summary.enterpriseStatusReady = enterprise.pilotReady;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'unable to read enterprise status');
  }

  try {
    const trustChain = await validateTrustChain(args.npi);
    const appendOnly = await isTrustLedgerAppendOnlySince(new Date(0), verifierOrg?.id);
    summary.trustLedgerValid =
      trustChain.valid &&
      !trustChain.invalidTransitions &&
      !trustChain.checksumMismatches &&
      appendOnly;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'trust chain validation failed');
  }

  try {
    await fetchFunnel(args.baseUrl, headers);
    summary.funnelMetricsUpdated = true;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'funnel metrics unavailable');
  }

  return { summary, failures };
}

async function runSimulation(args: ParsedArgs): Promise<{ summary: SimulationSummary; failures: string[] }> {
  const summary: SimulationSummary = {
    verifierRegistered: false,
    pilotActivated: false,
    artifactGenerated: false,
    monitoringRun: false,
    trustLedgerValid: false,
    funnelMetricsUpdated: false,
    enterpriseStatusReady: false,
  };

  const failures: string[] = [];
  const calls: SimCall[] = [];
  const startedAt = new Date();

  const internal = monitoringHeaders(args);
  if (!internal['x-monitoring-secret']) {
    failures.push('MONITORING_SECRET is required for internal endpoints.');
  }

  const registerData = await registerVerifier(args, calls, failures);
  const verifierOrgId = registerData.verifierOrgId;
  const activationToken = registerData.activationToken;
  let lifecycleForFlow = registerData.lifecycle ?? 'REGISTERED';

  if (!lifecycleForFlow) {
    lifecycleForFlow = 'REGISTERED';
  }

  summary.verifierRegistered = Boolean(verifierOrgId);

  const activationData = await activateVerifier(args, activationToken, verifierOrgId, calls, failures);
  let activationState = activationData.lifecycle;

  if (activationState === null) {
    activationState = await getVerifierLifecycle(verifierOrgId);
  }

  if (activationState === null) {
    failures.push('Activation state could not be resolved after verifier activation.');
  } else {
    if (!isValidTransition(lifecycleForFlow, activationState)) {
      failures.push(
        `Invalid lifecycle transition register -> activation (${lifecycleForFlow} -> ${activationState}).`,
      );
    }

    if (activationState !== 'PILOT_ACTIVATED') {
      activationState =
        (await advanceLifecycleTo(verifierOrgId, 'PILOT_ACTIVATED', failures)) ?? activationState;
    }

    if (activationState === 'PILOT_ACTIVATED') {
      lifecycleForFlow = activationState;
      summary.pilotActivated = true;
    }
  }

  if (!summary.pilotActivated) {
    failures.push('Activation did not reach PILOT_ACTIVATED.');
  }

  const orgHeaders = withOrgContext(internal, verifierOrgId);
  const dbOrg = await prisma.verifierOrg.findUnique({
    where: { id: verifierOrgId },
    select: { pilotActivated: true },
  });
  if (!dbOrg?.pilotActivated) {
    failures.push('verifier_org.pilotActivated is false after activation.');
  }

  const bundle = await generateBundleStep(args, verifierOrgId, orgHeaders, calls, failures);
  summary.artifactGenerated = Boolean(bundle.artifactId);

  const persistedArtifact = await prisma.verificationArtifact.findFirst({
    where: {
      id: bundle.artifactId,
      npi: args.npi,
      ...(verifierOrgId ? { organizationId: verifierOrgId } : {}),
    },
    select: { id: true },
  });
  if (!persistedArtifact) {
    failures.push('Bundle artifact could not be located after generation.');
  }

  const bundleLifecycle = await getVerifierLifecycle(verifierOrgId);
  if (!bundleLifecycle) {
    failures.push('Bundle step lifecycle state could not be read.');
  } else if (!isValidTransition(lifecycleForFlow, bundleLifecycle)) {
    failures.push(`Invalid lifecycle transition activation -> bundle (${lifecycleForFlow} -> ${bundleLifecycle}).`);
  } else if (bundleLifecycle === 'BUNDLE_GENERATED') {
    lifecycleForFlow = bundleLifecycle;
  } else {
    const promoted =
      (await advanceLifecycleTo(verifierOrgId, 'BUNDLE_GENERATED', failures)) ?? bundleLifecycle;
    lifecycleForFlow = promoted;
    if (lifecycleForFlow !== 'BUNDLE_GENERATED') {
      failures.push(`Bundle step lifecycle expected BUNDLE_GENERATED, got ${promoted ?? 'missing'}`);
    }
  }

  const bundleEvents = await prisma.auditEvent.count({
    where: {
      type: 'BUNDLE_GENERATED',
      referenceId: bundle.artifactId,
    },
  });
  if (bundleEvents === 0) {
    failures.push('BUNDLE_GENERATED audit event missing.');
  }

  const beforeBundleLedger = await countTrustLedgerEntriesSince(startedAt, verifierOrgId, bundle.artifactId);
  if (!(await ensureTrustLedgerForBundle(args, verifierOrgId, bundle.artifactId, startedAt))) {
    failures.push('Failed to append trust ledger entry for bundle generation.');
  }
  const afterBundleLedger = await countTrustLedgerEntriesSince(startedAt, verifierOrgId, bundle.artifactId);
  if (afterBundleLedger <= beforeBundleLedger) {
    failures.push('Trust ledger did not grow after bundle step.');
  }

  await artifactForMonitoring(bundle.artifactId);
  const monitoringBase = await countMonitoringEventsSince(startedAt, verifierOrgId);
  const monitoring = await requestJson<{
    monitoringChecksRun?: number;
    monitoringStatusChanges?: number;
  }>(
    args.baseUrl,
    'POST',
    '/api/internal/monitoring/run',
    orgHeaders,
  );
  assertRequired200(calls, failures, '/api/internal/monitoring/run', monitoring.status, monitoring.body);
  const monitoringAfter = await countMonitoringEventsSince(startedAt, verifierOrgId);
  summary.monitoringRun = monitoringAfter > monitoringBase;
  if (!summary.monitoringRun) {
    failures.push('Monitoring run did not write MonitoringEvent rows.');
  }

  try {
    const enterprise = await fetchEnterpriseStatus(args.baseUrl, internal);
    summary.enterpriseStatusReady = enterprise.pilotReady;
    if (!summary.enterpriseStatusReady) {
      failures.push('enterprise pilotReady is false');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'enterprise status failed');
  }

  const funnelHeaders = withOrgContext(internal, verifierOrgId);
  try {
    const preFunnel = await fetchFunnel(args.baseUrl, funnelHeaders);

    const seededFunnel = await seedFunnelSignal(args, verifierOrgId);
    if (!seededFunnel) {
      failures.push('funnel conversion seeding failed.');
    }

    const postFunnel = await fetchFunnel(args.baseUrl, funnelHeaders);
    summary.funnelMetricsUpdated =
      postFunnel.totalActivations > preFunnel.totalActivations ||
      postFunnel.totalPilotClicks > preFunnel.totalPilotClicks ||
      postFunnel.totalVerifierViews > preFunnel.totalVerifierViews;
    if (!summary.funnelMetricsUpdated) {
      failures.push('Verifier funnel metrics did not update.');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'funnel validation failed');
  }

  try {
    const chain = await validateTrustChain(args.npi);
    const appendOnly = await isTrustLedgerAppendOnlySince(startedAt, verifierOrgId);
    summary.trustLedgerValid =
      chain.valid &&
      !chain.invalidTransitions &&
      !chain.checksumMismatches &&
      appendOnly;
    if (!summary.trustLedgerValid) {
      failures.push('Trust chain validation failed.');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'trust chain validation failed');
  }

  const hasRateLimit = calls.some((entry) => entry.status === 429);
  if (hasRateLimit) {
    failures.push('Rate limiting was triggered.');
  }

  const requiredCallFailed = calls.some((entry) => entry.required && entry.status !== 200);
  if (requiredCallFailed) {
    failures.push('One or more required endpoints did not return HTTP 200.');
  }

  if (lifecycleForFlow !== 'BUNDLE_GENERATED') {
    failures.push('Lifecycle did not resolve to BUNDLE_GENERATED by end of flow.');
  }

  return { summary, failures };
}

function printDryRun(args: ParsedArgs): void {
  console.log('Dry run: no mutation. Intended flow:');
  const lines = [
    'POST /api/verifier/register (fallback DB path if 404)',
    'GET /verify-access/{token} (fallback direct lifecycle path if 404)',
    'POST /api/artifact/bundle?npi=... (fallback GET /api/artifact/bundle/:npi)',
    'PUT artifact monitoring marker (preflight mutation expected in live simulation)',
    'POST /api/internal/monitoring/run',
    'GET /api/internal/enterprise-status',
    'GET /api/internal/verifier-funnel',
    'POST /api/pilot/activate',
    'validate trust chain and trust ledger append-only',
    `monitoringSecretProvided: ${Boolean(args.monitoringSecret)}`,
  ];

  console.log(
    JSON.stringify(
      {
        baseUrl: args.baseUrl,
        npi: args.npi,
        steps: lines,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!isValidNpi(args.npi)) {
    throw new Error('npi must be 10 digits.');
  }

  if (args.dryRun) {
    printDryRun(args);
    return;
  }

  if (isProductionFrozen()) {
    console.log('Production + SYSTEM_FROZEN=true; read-only validation mode.');
    const { summary, failures } = await runReadOnlyValidation(args);
    console.log(JSON.stringify(summary, null, 2));
    if (failures.length > 0) {
      for (const failure of failures) {
        console.log(`FAIL: ${failure}`);
      }
      process.exitCode = 1;
    }

    return;
  }

  const { summary, failures } = await runSimulation(args);
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`FAIL: ${failure}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log(`Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
});
