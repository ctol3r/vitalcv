import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { PolkadotService } from './blockchain/polkadot_service';
import { neo4jConfigured } from './graph/neo4jHttp';
import {
  ensureGraphSchema,
  getGraphView,
  getReadinessScore,
  getSpecialtyDensity,
  graphHealth,
  seedDemoGraph,
  upsertIssuanceToGraph,
} from './graph/service';
import prisma from './graphql/prisma_client';
import { issueNonce, issueOidcCredential, pollDeferredCredential } from './issuer';
import { errorHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/validateRequest';
import { log, reqLogFields } from './obs/logger';
import { requestIdMiddleware, type RequestWithId } from './obs/requestId';

const app = express();
const bootedAtIso = new Date().toISOString();

app.disable('x-powered-by');

// Request correlation
app.use(requestIdMiddleware);

app.use(express.json());

// Basic CORS for local dev + simple deployments (browser calls backend directly from apps/web)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow = process.env.CORS_ORIGIN;
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow);
  } else if (origin) {
    // Reflect origin in dev; in production prefer setting CORS_ORIGIN
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// Basic structured access logs (single-line JSON)
app.use((req: RequestWithId, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    log('info', 'http_request', {
      ...reqLogFields(req),
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function privacyDigest(value: string): string {
  const pepper = process.env.WORLD_ID_PEPPER || process.env.WORLD_ID_NULLIFIER_PEPPER || '';
  // Pepper is optional; if omitted this is still one-way, but less resistant to cross-system correlation.
  return sha256Hex(`${pepper}:${value}`);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    const headPath = path.join(dir, '.git', 'HEAD');
    if (fs.existsSync(headPath)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function tryReadGitShaFromDotGit(repoRoot: string): string | null {
  try {
    const headPath = path.join(repoRoot, '.git', 'HEAD');
    const head = fs.readFileSync(headPath, 'utf8').trim();
    if (!head) return null;

    if (head.startsWith('ref:')) {
      const ref = head.replace(/^ref:\s*/, '').trim();
      if (!ref) return null;

      const refPath = path.join(repoRoot, '.git', ref);
      if (fs.existsSync(refPath)) {
        const sha = fs.readFileSync(refPath, 'utf8').trim();
        return sha || null;
      }

      const packedRefsPath = path.join(repoRoot, '.git', 'packed-refs');
      if (fs.existsSync(packedRefsPath)) {
        const packed = fs.readFileSync(packedRefsPath, 'utf8');
        for (const line of packed.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('^')) continue;
          const [shaCandidate, refName] = trimmed.split(' ');
          if (refName === ref && shaCandidate) return shaCandidate.trim();
        }
      }

      return null;
    }

    if (/^[0-9a-f]{7,40}$/i.test(head)) return head;
    return null;
  } catch {
    return null;
  }
}

function resolveGitSha(): string {
  const envSha = [
    process.env.GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.RENDER_GIT_COMMIT,
  ]
    .map((v) => String(v || '').trim())
    .find(Boolean);
  if (envSha) return envSha;

  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) return 'unknown';
  return tryReadGitShaFromDotGit(repoRoot) || 'unknown';
}

function resolveBuiltAtIso(): string {
  const fromEnv = [
    process.env.BUILT_AT,
    process.env.BUILD_TIME,
    process.env.VERCEL_BUILD_TIME,
    process.env.NEXT_PUBLIC_VERCEL_BUILD_TIME,
  ]
    .map((v) => String(v || '').trim())
    .find(Boolean);
  if (fromEnv) return fromEnv;

  const sourceDateEpoch = String(process.env.SOURCE_DATE_EPOCH || '').trim();
  if (/^\d+$/.test(sourceDateEpoch)) {
    const seconds = Number(sourceDateEpoch);
    if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000).toISOString();
  }

  return bootedAtIso;
}

function resolveEnvironment(): string {
  return (
    String(process.env.ENVIRONMENT || '').trim() ||
    String(process.env.VERCEL_ENV || '').trim() ||
    String(process.env.NODE_ENV || '').trim() ||
    'development'
  );
}

const gitSha = resolveGitSha();
const builtAtIso = resolveBuiltAtIso();
const environmentName = resolveEnvironment();

function normalizeCredentialId(raw: string): { externalId: string; dbId?: number } {
  const trimmed = raw.trim();
  if (!trimmed) return { externalId: '' };
  if (/^CRED-\d+$/i.test(trimmed)) {
    const dbId = Number(trimmed.split('-')[1]);
    return { externalId: `CRED-${dbId}`, dbId };
  }
  const asInt = Number(trimmed);
  if (Number.isInteger(asInt) && asInt > 0) return { externalId: `CRED-${asInt}`, dbId: asInt };
  return { externalId: trimmed };
}

function signDemoJwt(payload: Record<string, unknown>): string {
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn: '7d' });
}

function resolveJwtSecret(): string {
  return (
    process.env.ISSUER_SIGNING_KEY ||
    process.env.JWT_SECRET ||
    process.env.ISSUER_JWT_SECRET ||
    'dev-only-secret'
  );
}

function resolveIssuerId(fallback?: string | null): string | null {
  const issuerId = String(
    process.env.ISSUER_ID || process.env.JWT_ISSUER || process.env.ISSUER_NAME || '',
  ).trim();
  if (issuerId) return issuerId;
  if (fallback === undefined || fallback === null) return null;
  const trimmed = String(fallback).trim();
  return trimmed ? trimmed : null;
}

const DEFAULT_RENEWAL_WINDOW_DAYS = Number(process.env.DEFAULT_RENEWAL_WINDOW_DAYS || 90);

function resolveRenewalWindowDays(value?: unknown): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  if (Number.isFinite(DEFAULT_RENEWAL_WINDOW_DAYS) && DEFAULT_RENEWAL_WINDOW_DAYS > 0)
    return Math.floor(DEFAULT_RENEWAL_WINDOW_DAYS);
  return 90;
}

function resolveAuthorityId(value?: unknown, fallback?: string | null): string | null {
  const candidate = String(value ?? '').trim();
  if (candidate) return candidate;
  return resolveIssuerId(fallback);
}

const AUTHORITY_RENEWAL_GUIDES: Record<
  string,
  {
    renewalUrl: string;
    contactEmail?: string;
    contactPhone?: string;
    renewalSteps: string[];
  }
> = {
  STATE_MED_BOARD: {
    renewalUrl: 'https://www.fsmb.org/physicians/state-medical-boards/',
    contactEmail: 'licensing@stateboard.example',
    renewalSteps: [
      'Confirm renewal window and CE requirements on the state medical board portal.',
      'Submit renewal application and required attestations.',
      'Upload proof of completed CME/CE credits and pay renewal fees.',
    ],
  },
  DEA: {
    renewalUrl: 'https://www.deadiversion.usdoj.gov/drugreg/registration/renewal/',
    contactPhone: '+1-571-362-6905',
    renewalSteps: [
      'Sign in to the DEA Diversion Control Division portal.',
      'Complete the renewal application and verify address/registration data.',
      'Pay renewal fees and submit confirmation.',
    ],
  },
  DEFAULT: {
    renewalUrl: 'https://vitalcv.example.com/renewal-support',
    contactEmail: 'renewals@vitalcv.example.com',
    renewalSteps: [
      'Review credential requirements with the issuing authority.',
      'Prepare required attestations and supporting documentation.',
      'Submit renewal via the authority portal and confirm completion.',
    ],
  },
};

type LifecycleState = 'ACTIVE' | 'RENEWAL_WINDOW' | 'EXPIRED';

function evaluateLifecycle(expiresAtIso: string | null, renewalWindowDays: number): {
  daysRemaining: number | null;
  currentState: LifecycleState;
} {
  if (!expiresAtIso) {
    return { daysRemaining: null, currentState: 'ACTIVE' };
  }
  const expiresAtMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresAtMs)) {
    return { daysRemaining: null, currentState: 'ACTIVE' };
  }
  const now = Date.now();
  const msRemaining = expiresAtMs - now;
  const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
  if (msRemaining <= 0) {
    return { daysRemaining, currentState: 'EXPIRED' };
  }
  if (renewalWindowDays > 0 && daysRemaining <= renewalWindowDays) {
    return { daysRemaining, currentState: 'RENEWAL_WINDOW' };
  }
  return { daysRemaining, currentState: 'ACTIVE' };
}

function resolveCredentialExpiry(expiryDate?: string | null): {
  expiresAt: string;
  expiresInSeconds: number;
} {
  const now = Date.now();
  const defaultTtlSeconds = Number(process.env.JWT_CREDENTIAL_TTL_SECONDS || 60 * 60 * 24 * 30);
  const parsed = expiryDate ? Date.parse(expiryDate) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > now) {
    const expiresInSeconds = Math.max(1, Math.floor((parsed - now) / 1000));
    return { expiresAt: new Date(parsed).toISOString(), expiresInSeconds };
  }
  return { expiresAt: new Date(now + defaultTtlSeconds * 1000).toISOString(), expiresInSeconds: defaultTtlSeconds };
}

function signCredentialJwt(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const issuer = process.env.JWT_ISSUER || 'vitalcv-demo-issuer';
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn: expiresInSeconds, issuer });
}

function computeProofHash(artifact: string): string {
  return sha256Hex(artifact);
}

function isJwtLike(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every(Boolean);
}

function decodeJwtPayload(token: string): jwt.JwtPayload | null {
  const decoded = jwt.decode(token);
  return decoded && typeof decoded === 'object' ? (decoded as jwt.JwtPayload) : null;
}

function resolveIssuedAtFromPayload(payload: jwt.JwtPayload | null): string | null {
  if (!payload) return null;
  const issuedAtRaw = (payload as Record<string, unknown>).issuedAt;
  if (issuedAtRaw) {
    const parsed = Date.parse(String(issuedAtRaw));
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof payload.iat === 'number') return new Date(payload.iat * 1000).toISOString();
  return null;
}

function resolveExpiresAtFromPayload(payload: jwt.JwtPayload | null): string | null {
  if (!payload) return null;
  const expiresAtRaw =
    (payload as Record<string, unknown>).expiresAt ||
    (payload as Record<string, unknown>).expiryDate;
  if (expiresAtRaw) {
    const parsed = Date.parse(String(expiresAtRaw));
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof payload.exp === 'number') return new Date(payload.exp * 1000).toISOString();
  return null;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, derived] = passwordHash.split(':');
  if (!salt || !derived) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(computed, 'hex'));
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

type AuditEventInput = {
  eventType: string;
  subjectId?: string | null;
  userId?: number;
  metadata?: any;
};

type AuditEventResult = {
  eventType: string;
  subjectId: string | null;
  createdAt: string;
  hash: string;
};

function normalizeSubjectId(value?: string | number | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function extractCredentialIdFromPayload(payload: jwt.JwtPayload | null): string | null {
  if (!payload) return null;
  const candidate =
    (payload as Record<string, unknown>).credentialId ||
    (payload as Record<string, unknown>).credential_id ||
    (payload as Record<string, unknown>).subjectId ||
    (payload as Record<string, unknown>).id ||
    payload.sub;
  return normalizeSubjectId(candidate as string | number | null);
}

async function writeAuditEvent(event: AuditEventInput): Promise<AuditEventResult> {
  const createdAt = new Date();
  const eventType = String(event.eventType || '').trim();
  if (!eventType) throw new Error('audit eventType is required');
  const subjectId =
    normalizeSubjectId(event.subjectId) ??
    (event.userId !== undefined ? normalizeSubjectId(`user:${event.userId}`) : null);
  const payload = {
    eventType,
    subjectId,
    createdAt: createdAt.toISOString(),
    metadata: event.metadata || null,
  };
  const hash = sha256Hex(JSON.stringify(payload));

  await prisma.auditEvent.create({
    data: {
      type: eventType,
      hash,
      credentialId: subjectId ?? undefined,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { eventType, subjectId, createdAt: createdAt.toISOString(), hash };
}

async function ensureAuditEventOnce(
  eventType: string,
  subjectId: string,
  metadata?: Record<string, unknown>,
): Promise<{ auditRef: string; created: boolean }> {
  const existing = await prisma.auditEvent.findFirst({
    where: { type: eventType, credentialId: subjectId },
    orderBy: { createdAt: 'desc' },
  });
  if (existing?.hash) return { auditRef: existing.hash, created: false };
  const audit = await writeAuditEvent({ eventType, subjectId, metadata });
  return { auditRef: audit.hash, created: true };
}

function resolveAuthorityGuide(authorityId: string | null) {
  if (!authorityId) return AUTHORITY_RENEWAL_GUIDES.DEFAULT;
  return AUTHORITY_RENEWAL_GUIDES[authorityId] || AUTHORITY_RENEWAL_GUIDES.DEFAULT;
}

async function appendAuditCheck(
  eventType: string,
  subjectId: string,
  metadata?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<{ ok: boolean; hash?: string; createdAt?: string; error?: string }> {
  const effectiveTimeoutMs = Number.isFinite(timeoutMs)
    ? (timeoutMs as number)
    : Number(process.env.HEALTH_DB_TIMEOUT_MS || 800);
  try {
    const audit = await withTimeout(
      writeAuditEvent({ eventType, subjectId, metadata }),
      effectiveTimeoutMs,
      'audit',
    );
    return { ok: true, hash: audit.hash, createdAt: audit.createdAt };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}

function merkleRootHex(hashes: string[]): string | null {
  if (hashes.length === 0) return null;
  let layer: Buffer<ArrayBufferLike>[] = hashes.map((h) => Buffer.from(h, 'hex'));
  while (layer.length > 1) {
    const next: Buffer<ArrayBufferLike>[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i]; // duplicate last if odd
      next.push(
        crypto
          .createHash('sha256')
          .update(Buffer.concat([left, right]))
          .digest(),
      );
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

// --- Proof infra endpoints ---
// Minimal ON-contract health endpoint (keep /healthz for detailed dependency checks)
app.get('/health', async (_req, res) => {
  const dbTimeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 800);
  const dbOk = await withTimeout(
    prisma.$queryRaw`SELECT 1`,
    dbTimeoutMs,
    'db',
  )
    .then(() => true)
    .catch(() => false);
  const auditAppend = dbOk
    ? await appendAuditCheck('HEALTH_CHECK', 'health', { status: dbOk ? 'ok' : 'degraded' }, dbTimeoutMs)
    : { ok: false, error: 'db_unavailable' };
  const ok = dbOk && auditAppend.ok;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    gitSha,
    audit: auditAppend,
  });
});

app.get('/healthz', async (_req, res) => {
  const startedAt = Date.now();
  const dbTimeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 1200);

  const dbPromise = withTimeout(
    prisma.$queryRaw`SELECT 1`,
    dbTimeoutMs,
    'db',
  )
    .then(() => ({ ok: true as const }))
    .catch((e) => ({ ok: false as const, error: String(e instanceof Error ? e.message : e) }));

  const auditPromise = withTimeout(
    prisma.auditEvent.findFirst({
      select: { hash: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    dbTimeoutMs,
    'audit',
  )
    .then((event) => ({
      ok: true as const,
      lastEventAt: event?.createdAt?.toISOString?.() ?? null,
      lastEventHash: event?.hash ?? null,
    }))
    .catch((e) => ({ ok: false as const, error: String(e instanceof Error ? e.message : e) }));

  // Substrate is optional for ON. If configured we show it, but we don't block readiness on chain connectivity.
  const chainPromise = withTimeout(
    (async () => {
      const ws = String(process.env.SUBSTRATE_WS || '').trim();
      if (!ws) {
        return { ok: true as const, configured: false as const, status: 'not_configured' as const };
      }
      const endpoints = ws
        .split(',')
        .map((endpoint) => endpoint.trim())
        .filter(Boolean);
      const maxLagBlocks = Number(process.env.HEALTH_CHAIN_MAX_LAG || 64);
      const chainTimeoutMs = Number(process.env.HEALTH_CHAIN_TIMEOUT_MS || 1200);
      const service = new PolkadotService(undefined, {
        endpoints,
        connectTimeoutMs: chainTimeoutMs,
        maxConnectAttempts: 1,
        retryBackoffMs: 0,
        maxAllowedLagBlocks: maxLagBlocks,
      });

      try {
        await service.connect();
        const health = await service.getHealth();
        const ok = !health.isSyncing && health.lagBlocks <= maxLagBlocks;
        return { ok, configured: true as const, status: health };
      } finally {
        await service.disconnect().catch(() => undefined);
      }
    })(),
    Number(process.env.HEALTH_CHAIN_TIMEOUT_MS || 1200),
    'substrate',
  ).catch((e) => ({
    ok: false as const,
    configured: Boolean(String(process.env.SUBSTRATE_WS || '').trim()),
    error: String(e instanceof Error ? e.message : e),
  }));

  const acapyPromise = withTimeout(
    (async () => {
      const url = (process.env.ACAPY_ADMIN_URL || 'http://localhost:8031').replace(/\/$/, '');
      const resp = await fetch(`${url}/status`, { method: 'GET' });
      if (!resp.ok) throw new Error(`acapy status ${resp.status}`);
      const data = await resp.json().catch(() => ({}));
      return { ok: true as const, status: data };
    })(),
    Number(process.env.HEALTH_ACAPY_TIMEOUT_MS || 1200),
    'acapy',
  ).catch((e) => ({ ok: false as const, error: String(e instanceof Error ? e.message : e) }));

  const graphPromise = withTimeout(
    (async () => {
      const url = String(process.env.GRAPH_STATUS_URL || '').trim();
      if (url) {
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) throw new Error(`graph status ${resp.status}`);
        const data = await resp.json().catch(() => ({}));
        return { ok: true as const, configured: true as const, status: data };
      }

      if (!neo4jConfigured()) {
        return {
          ok: false as const,
          configured: false as const,
          status: 'not_configured' as const,
        };
      }

      const gh = await graphHealth();
      return { ok: Boolean(gh.ok), configured: true as const, status: gh.info ?? null };
    })(),
    Number(process.env.HEALTH_GRAPH_TIMEOUT_MS || 1200),
    'graph',
  ).catch((e) => ({
    ok: false as const,
    configured: Boolean(String(process.env.GRAPH_STATUS_URL || '').trim() || neo4jConfigured()),
    error: String(e instanceof Error ? e.message : e),
  }));

  const agentPromise = withTimeout(
    (async () => {
      const url = String(process.env.AGENT_STATUS_URL || '').trim();
      if (!url)
        return {
          ok: false as const,
          configured: false as const,
          status: 'not_configured' as const,
        };
      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) throw new Error(`agent status ${resp.status}`);
      const data = await resp.json().catch(() => ({}));
      return { ok: true as const, configured: true as const, status: data };
    })(),
    Number(process.env.HEALTH_AGENT_TIMEOUT_MS || 1200),
    'agent',
  ).catch((e) => ({
    ok: false as const,
    configured: Boolean(String(process.env.AGENT_STATUS_URL || '').trim()),
    error: String(e instanceof Error ? e.message : e),
  }));

  const [db, audit, chain, acapy, graph, agent] = await Promise.all([
    dbPromise,
    auditPromise,
    chainPromise,
    acapyPromise,
    graphPromise,
    agentPromise,
  ]);
  const baseOk = db.ok && audit.ok && chain.ok && acapy.ok;
  const auditAppend = db.ok
    ? await appendAuditCheck('HEALTHZ_CHECK', 'healthz', {
        status: baseOk ? 'ok' : 'degraded',
        dbOk: db.ok,
        auditOk: audit.ok,
        chainOk: chain.ok,
        acapyOk: acapy.ok,
      }, dbTimeoutMs)
    : { ok: false, error: 'db_unavailable' };
  const ok = baseOk && auditAppend.ok;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    checks: {
      db,
      audit,
      auditAppend,
      substrate: chain,
      acapy,
      graph,
      agent,
      worldId: {
        ok: Boolean(String(process.env.WORLD_ID_APP_ID || '').trim()),
        configured: Boolean(String(process.env.WORLD_ID_APP_ID || '').trim()),
      },
    },
  });
});

app.get(['/ready', '/readyz'], async (_req, res) => {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 800);
  const [db, audit] = await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs, 'db')
      .then(() => true)
      .catch(() => false),
    withTimeout(
      prisma.auditEvent.findFirst({ select: { id: true }, orderBy: { createdAt: 'desc' } }),
      timeoutMs,
      'audit',
    )
      .then(() => true)
      .catch(() => false),
  ]);
  const auditAppend = db
    ? await appendAuditCheck('READYZ_CHECK', 'readyz', {
        status: db && audit ? 'ready' : 'not_ready',
        dbOk: db,
        auditOk: audit,
      }, timeoutMs)
    : { ok: false, error: 'db_unavailable' };
  // For readiness, require DB + audit log access; other dependencies are reported in /health.
  const ok = db && audit && auditAppend.ok;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    services: {
      database: db,
      auditLog: audit,
      auditAppend,
    },
  });
});

app.get('/build-info', (_req, res) => {
  res.json({
    commit: gitSha,
    builtAt: builtAtIso,
    environment: environmentName,
    gitSha:
      gitSha ||
      process.env.GIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      'unknown',
    buildTime: builtAtIso || process.env.BUILD_TIME || process.env.VERCEL_BUILD_TIME || 'unknown',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

// --- World ID (Phase 1: AuthN only) ---
app.get('/worldid/status', async (_req, res) => {
  const configured = Boolean(String(process.env.WORLD_ID_APP_ID || '').trim());
  const last = await prisma.auditEvent.findFirst({
    where: { type: 'WORLD_ID_VERIFIED' },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    configured,
    lastVerificationHash: last?.hash ?? null,
    lastVerifiedAt: last?.createdAt?.toISOString?.() ?? null,
  });
});

app.post(
  '/worldid/verify',
  body('action').isString().withMessage('action is required'),
  body('signal').optional().isString(),
  body('consent').optional().isBoolean(),
  body('nullifier_hash').isString().withMessage('nullifier_hash is required'),
  body('merkle_root').isString().withMessage('merkle_root is required'),
  body('proof').exists().withMessage('proof is required'),
  body('verification_level').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
    const appId = String(process.env.WORLD_ID_APP_ID || '').trim();
    if (!appId) {
      const audit = await writeAuditEvent({
        eventType: 'WORLD_ID_VERIFY_ATTEMPT',
        subjectId: 'worldid',
        metadata: { status: 'not_configured' },
      });
      return res.status(501).json({
        verified: false,
        status: 'not_configured',
        auditRef: audit.hash,
      });
    }

    const { action, signal, consent, nullifier_hash, merkle_root, proof, verification_level } =
      req.body as Record<string, any>;

    const verifyUrl =
      String(process.env.WORLD_ID_VERIFY_URL || '').trim() ||
      `https://developer.worldcoin.org/api/v1/verify/${encodeURIComponent(appId)}`;

    const payload = {
      action,
      signal: signal ?? undefined,
      nullifier_hash,
      merkle_root,
      proof,
      verification_level: verification_level ?? undefined,
    };

    let verified = false;
    let upstream: any = null;
    try {
      const resp = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      upstream = await resp.json().catch(() => ({ ok: resp.ok, status: resp.status }));
      verified = Boolean(resp.ok && (upstream?.success === true || upstream?.verified === true));
    } catch (e) {
      upstream = { error: String(e instanceof Error ? e.message : e) };
      verified = false;
    }

    // Hash-only audit entry. Do NOT store raw nullifier_hash.
    const pepper = String(process.env.WORLD_ID_AUDIT_PEPPER || '').trim();
    const nullifierHashHash = sha256Hex(`${String(nullifier_hash)}:${pepper}`);
    const audit = await writeAuditEvent({
      eventType: verified ? 'WORLD_ID_VERIFIED' : 'WORLD_ID_VERIFY_FAILED',
      subjectId: `worldid:${nullifierHashHash}`,
      metadata: {
        action,
        verificationLevel: verification_level ?? null,
        consent: consent === true,
        nullifierHashHash,
      },
    });

    return res.status(verified ? 200 : 400).json({
      verified,
      auditRef: audit.hash,
      upstream,
    });
  },
);

app.get('/audit/summary', async (_req, res) => {
  const [lastIssue, lastVerify, lastRevoke, recent, eventCount] = await Promise.all([
    prisma.auditEvent.findFirst({
      where: { type: 'ISSUE_CREDENTIAL' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditEvent.findFirst({
      where: { type: 'VERIFY_PRESENTATION' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditEvent.findFirst({
      where: { type: 'REVOKE_CREDENTIAL' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.auditEvent.count(),
  ]);

  const hashes = recent.map((e) => e.hash);
  const root = merkleRootHex(hashes);
  const latest = recent[0] || null;
  const latestEvent = latest
    ? {
        type: latest.type,
        timestamp: latest.createdAt?.toISOString?.() ?? null,
        eventType: latest.type,
        subjectId: latest.credentialId ?? (latest.userId ? `user:${latest.userId}` : null),
        createdAt: latest.createdAt?.toISOString?.() ?? null,
        hash: latest.hash ?? null,
      }
    : null;

  res.json({
    lastEvent: latestEvent,
    eventCount,
    latestHash: latest?.hash ?? null,
    lastCredentialIssuanceHash: lastIssue?.hash ?? null,
    lastCredentialIssuanceAt: lastIssue?.createdAt?.toISOString?.() ?? null,
    lastVerificationHash: lastVerify?.hash ?? null,
    lastVerificationAt: lastVerify?.createdAt?.toISOString?.() ?? null,
    lastRevocationHash: lastRevoke?.hash ?? null,
    lastRevocationAt: lastRevoke?.createdAt?.toISOString?.() ?? null,
    merkleRoot: root,
    recentCount: recent.length,
    anchorReference: process.env.AUDIT_ANCHOR_REFERENCE || null,
  });
});

// Demo-safe seed (token-gated in production)
app.post('/demo/seed', async (req: Request, res: Response) => {
  const token = String(req.headers['x-seed-token'] || '');
  const required = process.env.DEMO_SEED_TOKEN;
  if (process.env.NODE_ENV === 'production' && required && token !== required) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const reset = Boolean(req.body?.reset);
  if (reset && process.env.NODE_ENV === 'production') {
    // Never allow destructive resets in production.
    return res.status(400).json({ error: 'reset is not allowed in production' });
  }

  if (reset) {
    await prisma.job.deleteMany();
    await prisma.credential.deleteMany();
    await prisma.user.deleteMany();
  }

  const demoIssuer = 'VitalCV Demo Issuer (Non-PHI)';
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: { name: 'Alice Example' },
    create: { email: 'alice@example.com', name: 'Alice Example', passwordHash: null },
  });
  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: { name: 'Bob Example' },
    create: { email: 'bob@example.com', name: 'Bob Example', passwordHash: null },
  });

  const existingCreds = await prisma.credential.findMany({
    where: { userId: { in: [alice.id, bob.id] }, issuer: demoIssuer },
  });
  const existingKey = new Set(existingCreds.map((c) => `${c.userId}:${c.name}`));
  const toCreate = [
    { name: 'Nursing License', issuer: demoIssuer, userId: alice.id },
    { name: 'Pharmacy Certification', issuer: demoIssuer, userId: bob.id },
  ].filter((c) => !existingKey.has(`${c.userId}:${c.name}`));
  if (toCreate.length) {
    await prisma.credential.createMany({ data: toCreate });
  }

  await writeAuditEvent({
    eventType: 'DEMO_SEED',
    subjectId: 'demo-seed',
    metadata: { reset, users: [alice.email, bob.email], created: toCreate.length },
  });

  return res.json({ ok: true, reset, createdCredentials: toCreate.length });
});

// --- Auth (demo-safe, real password hashing; no PHI) ---
app.post(
  '/auth/signup',
  body('email').isEmail().withMessage('email must be valid'),
  body('password').isString().isLength({ min: 6 }).withMessage('password must be at least 6 chars'),
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name?: string;
    };
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: {
        email,
        name: name?.trim() || email.split('@')[0],
        passwordHash: hashPassword(password),
      },
    });

    const token = signDemoJwt({ userId: user.id, email: user.email });
    await writeAuditEvent({
      eventType: 'AUTH_SIGNUP',
      subjectId: `user:${user.id}`,
      userId: user.id,
      metadata: { email: user.email },
    });

    return res
      .status(201)
      .json({ token, user: { id: user.id, email: user.email, name: user.name } });
  },
);

app.post(
  '/auth/login',
  body('email').isEmail().withMessage('email must be valid'),
  body('password').isString().withMessage('password required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    if (!verifyPassword(password, user.passwordHash))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = signDemoJwt({ userId: user.id, email: user.email });
    await writeAuditEvent({
      eventType: 'AUTH_LOGIN',
      subjectId: `user:${user.id}`,
      userId: user.id,
      metadata: { email: user.email },
    });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  },
);

// --- World ID (authn-only; optional; no PHI; hash-only audit) ---
app.post('/world-id/verify', validateRequest, async (req: Request, res: Response) => {
  const configuredAppId = process.env.WORLD_ID_APP_ID;
  const configuredAction = process.env.WORLD_ID_ACTION;
  const verifyUrl =
    process.env.WORLD_ID_VERIFY_URL || 'https://developer.worldcoin.org/api/v1/verify';
  const apiKey = process.env.WORLD_ID_API_KEY || process.env.WORLD_ID_VERIFY_KEY || '';

  const body = (req.body || {}) as Record<string, any>;
  const app_id = String(body.app_id || configuredAppId || '');
  const action = String(body.action || configuredAction || '');
  const signal = body.signal ? String(body.signal) : undefined;
  const credential_type = body.credential_type ? String(body.credential_type) : undefined;
  const proof = (body.proof || {}) as Record<string, any>;

  const merkle_root = proof.merkle_root
    ? String(proof.merkle_root)
    : String(body.merkle_root || '');
  const nullifier_hash = proof.nullifier_hash
    ? String(proof.nullifier_hash)
    : String(body.nullifier_hash || '');
  const zkProof = proof.proof ? String(proof.proof) : String(body.proof || '');

  // World ID is optional; if not configured, fail clearly (no mocks/bypasses).
  if (!app_id || !action) {
    return res.status(501).json({
      error:
        'World ID is not configured on this deployment (missing WORLD_ID_APP_ID / WORLD_ID_ACTION)',
    });
  }
  if (!apiKey) {
    return res.status(501).json({
      error:
        'World ID verification key is not configured on this deployment (missing WORLD_ID_API_KEY)',
    });
  }
  if (!merkle_root || !nullifier_hash || !zkProof) {
    return res.status(400).json({
      error: 'Missing required proof fields: merkle_root, nullifier_hash, proof',
    });
  }

  const startedAt = Date.now();
  try {
    const verifyResp = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id,
        action,
        signal: signal ?? '',
        credential_type: credential_type ?? 'orb',
        proof: {
          merkle_root,
          nullifier_hash,
          proof: zkProof,
        },
      }),
    });

    const rawText = await verifyResp.text();
    const verifyJson = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return { raw: rawText };
      }
    })();

    const nullifierDigest = privacyDigest(nullifier_hash);
    const signalDigest = signal ? privacyDigest(signal) : undefined;

    if (!verifyResp.ok) {
      const audit = await writeAuditEvent({
        eventType: 'WORLD_ID_VERIFY_FAILURE',
        subjectId: nullifierDigest ? `worldid:${nullifierDigest}` : 'worldid',
        metadata: {
          app_id,
          action,
          credential_type: credential_type ?? 'orb',
          nullifierDigest,
          signalDigest,
          httpStatus: verifyResp.status,
          latencyMs: Date.now() - startedAt,
        },
      });
      return res.status(401).json({
        success: false,
        verified: false,
        error: verifyJson?.detail || verifyJson?.error || 'World ID verification failed',
        auditRef: audit.hash,
      });
    }

    const audit = await writeAuditEvent({
      eventType: 'WORLD_ID_VERIFY_SUCCESS',
      subjectId: nullifierDigest ? `worldid:${nullifierDigest}` : 'worldid',
      metadata: {
        app_id,
        action,
        credential_type: credential_type ?? 'orb',
        nullifierDigest,
        signalDigest,
        latencyMs: Date.now() - startedAt,
      },
    });

    return res.status(200).json({
      success: true,
      verified: true,
      auditRef: audit.hash,
      result: verifyJson,
    });
  } catch (e) {
    const audit = await writeAuditEvent({
      eventType: 'WORLD_ID_VERIFY_ERROR',
      subjectId: nullifierDigest ? `worldid:${nullifierDigest}` : 'worldid',
      metadata: {
        app_id,
        action,
        credential_type: credential_type ?? 'orb',
        error: String(e instanceof Error ? e.message : e),
        latencyMs: Date.now() - startedAt,
      },
    });
    return res.status(502).json({
      success: false,
      verified: false,
      error: 'World ID verification request failed',
      auditRef: audit.hash,
    });
  }
});

// --- Demo VC issuance / verification / revocation ---
app.post('/issuer/credential', async (req: Request, res: Response, next) => {
  if (!req.body?.credential_request) return next();
  const result = await issueOidcCredential(req);
  const credentialRequest = req.body?.credential_request ?? {};
  const subjectId =
    credentialRequest.subject_id ??
    credentialRequest.credential_subject?.id ??
    credentialRequest.credential_subject?.did ??
    null;
  const issuedCredential =
    result && typeof (result as Record<string, unknown>).credential === 'string'
      ? (result as Record<string, unknown>).credential
      : null;
  const proofHash = issuedCredential ? computeProofHash(issuedCredential) : null;
  const issuedPayload = issuedCredential ? decodeJwtPayload(issuedCredential) : null;
  const issuedAt = resolveIssuedAtFromPayload(issuedPayload);
  const expiresAt = resolveExpiresAtFromPayload(issuedPayload);
  const credentialId = extractCredentialIdFromPayload(issuedPayload) || subjectId || null;
  const subjectIdValue =
    (issuedPayload?.sub as string | undefined) ||
    (issuedPayload as Record<string, unknown>)?.subjectId ||
    subjectId ||
    null;
  const renewalWindowDays = resolveRenewalWindowDays(
    credentialRequest.renewalWindowDays ??
      (issuedPayload as Record<string, unknown> | null)?.renewalWindowDays,
  );
  const issuerId = resolveIssuerId(
    (issuedPayload?.iss as string | undefined) ||
      (issuedPayload as Record<string, unknown>)?.issuerId ||
      (issuedPayload as Record<string, unknown>)?.issuer,
  );
  const authorityId = resolveAuthorityId(
    credentialRequest.authorityId ??
      (issuedPayload as Record<string, unknown>)?.authorityId,
    issuerId,
  );
  await writeAuditEvent({
    eventType: 'ISSUE_CREDENTIAL',
    subjectId: credentialId ? String(credentialId) : null,
    metadata: {
      credentialId: credentialId ? String(credentialId) : null,
      issuerId,
      subjectId: subjectIdValue ? String(subjectIdValue) : null,
      authorityId,
      renewalWindowDays,
      issuedAt,
      expiresAt,
      jwt: issuedCredential,
      proofHash,
      flow: 'oidc4vci',
      format: result?.format ?? null,
    },
  });
  return res.status(200).json({ ...result, proofHash });
});

app.post('/issuer/nonce', async (req: Request, res: Response) => {
  const result = await issueNonce(req);
  return res.status(200).json(result);
});

app.get('/issuer/deferred', async (req: Request, res: Response) => {
  const result = await pollDeferredCredential(req);
  return res.status(200).json(result);
});

app.post(
  '/issuer/credential',
  body('subjectId').isString().withMessage('subjectId is required'),
  body('type').isString().withMessage('type is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      subjectId,
      type,
      issuingAuthority,
      expiryDate,
      licenseNumber,
      additionalData,
      renewalWindowDays: renewalWindowDaysInput,
      authorityId: authorityIdInput,
    } = req.body as Record<string, any>;

    const isEmail = typeof subjectId === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subjectId);
    const email = isEmail
      ? subjectId
      : `holder-${sha256Hex(String(subjectId)).slice(0, 10)}@demo.vitalcv`;

    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: {
          email,
          name: String(subjectId).slice(0, 128),
          passwordHash: null,
        },
      }));

    const issuer =
      (issuingAuthority && String(issuingAuthority)) || 'VitalCV Demo Issuer (Non-PHI)';
    const issuerId = resolveIssuerId(issuer);
    const authorityId = resolveAuthorityId(authorityIdInput, issuerId || issuer);
    const expiryInput = expiryDate ? String(expiryDate) : null;
    const { expiresAt, expiresInSeconds } = resolveCredentialExpiry(expiryInput);
    const renewalWindowDays = resolveRenewalWindowDays(renewalWindowDaysInput);
    const credential = await prisma.credential.create({
      data: {
        name: String(type),
        issuer,
        authorityId: authorityId ?? undefined,
        userId: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        renewalWindowDays,
      },
    });

    const externalId = `CRED-${credential.id}`;
    const jwtPayload = {
      credentialId: externalId,
      subjectId,
      type,
      issuer,
      issuedAt: credential.issuedAt.toISOString(),
      expiryDate: expiresAt,
      expiresAt,
      renewalWindowDays,
      authorityId,
      licenseNumber: licenseNumber || null,
      additionalData: additionalData || null,
    };
    const jwtToken = signCredentialJwt(jwtPayload, expiresInSeconds);
    const proofHash = computeProofHash(jwtToken);

    const audit = await writeAuditEvent({
      eventType: 'ISSUE_CREDENTIAL',
      subjectId: externalId,
      userId: user.id,
      metadata: {
        credentialId: externalId,
        issuerId,
        subjectId: String(subjectId),
        authorityId,
        renewalWindowDays,
        ...jwtPayload,
        jwt: jwtToken,
        proofHash,
      },
    });


    // Mirror issuance into the network graph when configured (fail-soft).
    try {
      await upsertIssuanceToGraph({
        credentialId: externalId,
        credentialType: String(type),
        issuer,
        subjectEmail: user.email,
        subjectName: user.name,
      });
    } catch (e) {
      log('warn', 'graph_upsert_failed', {
        credentialId: externalId,
        error: String(e instanceof Error ? e.message : e),
      });
    }

    return res.status(200).json({
      credentialId: externalId,
      jwt: jwtToken,
      proofHash,
      auditRef: audit.hash,
      issuedAt: credential.issuedAt.toISOString(),
    });
  },
);

// --- Graph (Clinical Network Intelligence) ---
app.get('/graph/health', async (_req, res) => {
  if (!neo4jConfigured()) {
    return res.status(501).json({ configured: false, status: 'not_configured' });
  }
  const health = await graphHealth().catch((e) => ({
    ok: false,
    error: String(e instanceof Error ? e.message : e),
  }));
  return res.status(health.ok ? 200 : 503).json({ configured: true, ...health });
});

app.post('/graph/seed-demo', async (req: Request, res: Response) => {
  const token = String(req.headers['x-seed-token'] || '');
  const required = process.env.DEMO_SEED_TOKEN;
  if (process.env.NODE_ENV === 'production' && required && token !== required) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!neo4jConfigured()) return res.status(501).json({ error: 'Neo4j not configured' });

  await ensureGraphSchema();
  await seedDemoGraph();
  await writeAuditEvent({
    eventType: 'GRAPH_DEMO_SEED',
    subjectId: 'graph-seed',
    metadata: { ok: true },
  });
  return res.json({ ok: true });
});

app.get('/graph/view', async (req, res) => {
  if (!neo4jConfigured()) return res.status(501).json({ error: 'Neo4j not configured' });
  const limit = Number(req.query.limit || 200);
  const view = await getGraphView(Number.isFinite(limit) ? limit : 200);
  return res.json(view);
});

app.get('/graph/analytics/readiness-score', async (req, res) => {
  if (!neo4jConfigured()) return res.status(501).json({ error: 'Neo4j not configured' });
  const clinicianId = String(req.query.clinicianId || '').trim();
  if (!clinicianId) return res.status(400).json({ error: 'clinicianId is required' });
  const result = await getReadinessScore(clinicianId);
  return res.json(result);
});

app.get('/graph/analytics/specialty-density', async (req, res) => {
  if (!neo4jConfigured()) return res.status(501).json({ error: 'Neo4j not configured' });
  const limit = Number(req.query.limit || 10);
  const rows = await getSpecialtyDensity(Number.isFinite(limit) ? limit : 10);
  return res.json({ rows });
});

app.get('/issuer/credentials', async (_req, res) => {
  const creds = await prisma.credential.findMany({
    orderBy: { issuedAt: 'desc' },
    take: 100,
    include: { user: true },
  });

  const externalIds = creds.map((c) => `CRED-${c.id}`);
  const revokedEvents = await prisma.auditEvent.findMany({
    where: { type: 'REVOKE_CREDENTIAL', credentialId: { in: externalIds } },
    select: { credentialId: true },
  });
  const revoked = new Set(revokedEvents.map((e) => e.credentialId).filter(Boolean) as string[]);

  return res.json({
    credentials: creds.map((c) => ({
      id: `CRED-${c.id}`,
      type: c.name,
      holder: c.user?.name || c.user?.email,
      issuer: c.issuer,
      issuedDate: c.issuedAt.toISOString(),
      status: revoked.has(`CRED-${c.id}`) ? 'revoked' : 'active',
    })),
  });
});

app.post(
  '/issuer/revoke',
  body('credentialId').isString().withMessage('credentialId is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const { credentialId, reason } = req.body as { credentialId: string; reason?: string };
    const { externalId, dbId } = normalizeCredentialId(credentialId);
    if (!externalId) return res.status(400).json({ error: 'credentialId is required' });

    if (dbId) {
      const exists = await prisma.credential.findUnique({ where: { id: dbId } });
      if (!exists) return res.status(404).json({ error: 'Credential not found' });
    }

    const issuanceEvent = await prisma.auditEvent.findFirst({
      where: { type: 'ISSUE_CREDENTIAL', credentialId: externalId },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    const issuanceMetadata = (issuanceEvent?.metadata as Record<string, any>) ?? null;
    const proofHash = issuanceMetadata?.proofHash ? String(issuanceMetadata.proofHash) : null;
    const revokedAt = new Date().toISOString();

    const audit = await writeAuditEvent({
      eventType: 'REVOKE_CREDENTIAL',
      subjectId: externalId,
      metadata: { reason: reason || null, revokedAt, proofHash },
    });

    return res.json({ success: true, auditRef: audit.hash });
  },
);

app.post(
  '/verifier/presentation',
  body('credentialId').isString().withMessage('credentialId is required'),
  body('nonce').isString().withMessage('nonce is required'),
  body('audience').isString().withMessage('audience is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      credentialId,
      nonce,
      audience,
      privacyMode,
      disclosureType,
      jwt: jwtBody,
      credentialJwt,
      presentation,
    } = req.body as Record<string, any>;
    const rawCredentialInput = String(credentialId || '').trim();
    if (!rawCredentialInput) return res.status(400).json({ error: 'credentialId is required' });

    let presentedJwt = String(jwtBody || credentialJwt || presentation || '').trim();
    let lookupId = rawCredentialInput;
    if (!presentedJwt && isJwtLike(rawCredentialInput)) {
      presentedJwt = rawCredentialInput;
      lookupId = '';
    }

    const decodedPayload = presentedJwt ? decodeJwtPayload(presentedJwt) : null;
    const payloadCredentialId = extractCredentialIdFromPayload(decodedPayload);
    const resolvedId = payloadCredentialId || lookupId;
    const { externalId, dbId } = normalizeCredentialId(resolvedId);
    if (!externalId) return res.status(400).json({ error: 'credentialId is required' });

    const credential = dbId ? await prisma.credential.findUnique({ where: { id: dbId } }) : null;

    const issuanceEvent = await prisma.auditEvent.findFirst({
      where: { type: 'ISSUE_CREDENTIAL', credentialId: externalId },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    const issuanceMetadata = (issuanceEvent?.metadata as Record<string, any>) ?? null;
    const storedJwt = issuanceMetadata?.jwt || issuanceMetadata?.credential || issuanceMetadata?.signedCredential;
    if (!presentedJwt && typeof storedJwt === 'string' && storedJwt.trim()) {
      presentedJwt = storedJwt.trim();
    }

    const storedProofHash = issuanceMetadata?.proofHash ? String(issuanceMetadata.proofHash) : null;
    const computedProofHash = presentedJwt ? computeProofHash(presentedJwt) : null;
    const proofHash = computedProofHash ?? storedProofHash ?? null;
    const proofHashMatches = computedProofHash && storedProofHash ? computedProofHash === storedProofHash : true;

    let signatureValid = false;
    let signatureError: string | null = null;
    let verifiedPayload: jwt.JwtPayload | null = null;
    if (presentedJwt) {
      try {
        verifiedPayload = jwt.verify(presentedJwt, resolveJwtSecret(), {
          ignoreExpiration: true,
        }) as jwt.JwtPayload;
        signatureValid = true;
      } catch (e) {
        signatureError = String(e instanceof Error ? e.message : e);
      }
    }

    const payload = verifiedPayload ?? decodedPayload;
    const payloadExpiryRaw = payload
      ? (payload as Record<string, unknown>).expiryDate || (payload as Record<string, unknown>).expiresAt
      : null;
    const payloadExpiryMs = payloadExpiryRaw ? Date.parse(String(payloadExpiryRaw)) : Number.NaN;
    const expMs = payload && typeof payload.exp === 'number' ? payload.exp * 1000 : Number.NaN;
    const issuedExpiryRaw = issuanceMetadata?.expiryDate || issuanceMetadata?.expiresAt;
    const issuedExpiryMs = issuedExpiryRaw ? Date.parse(String(issuedExpiryRaw)) : Number.NaN;
    const credentialExpiryMs = credential?.expiresAt ? credential.expiresAt.getTime() : Number.NaN;
    const expiryCandidates = [expMs, payloadExpiryMs, issuedExpiryMs, credentialExpiryMs].filter(
      (value) => Number.isFinite(value),
    ) as number[];
    const expiryMs = expiryCandidates.length ? Math.min(...expiryCandidates) : null;
    const expired = expiryMs !== null && expiryMs <= Date.now();
    const expiryDate = expiryMs ? new Date(expiryMs).toISOString() : null;

    const payloadIssuedAtRaw = payload
      ? (payload as Record<string, unknown>).issuedAt
      : null;
    const payloadIssuedAtMs = payloadIssuedAtRaw
      ? Date.parse(String(payloadIssuedAtRaw))
      : Number.NaN;
    const issuedAt = credential?.issuedAt
      ? credential.issuedAt.toISOString()
      : Number.isFinite(payloadIssuedAtMs)
        ? new Date(payloadIssuedAtMs).toISOString()
        : payload && typeof payload.iat === 'number'
          ? new Date(payload.iat * 1000).toISOString()
          : null;

    const issuerName =
      credential?.issuer ||
      (payload ? (payload as Record<string, unknown>).issuer : null) ||
      payload?.iss ||
      issuanceMetadata?.issuer ||
      issuanceMetadata?.issuerId ||
      null;

    const lastRevoke = await prisma.auditEvent.findFirst({
      where: { type: 'REVOKE_CREDENTIAL', credentialId: externalId },
      orderBy: { createdAt: 'desc' },
    });
    const revoked = Boolean(lastRevoke);

    let status = 'valid';
    let reason: string | undefined;
    if (!presentedJwt) {
      status = 'missing_signature';
      reason = 'Missing signed credential';
    } else if (!signatureValid) {
      status = 'invalid_signature';
      reason = signatureError || 'Invalid signature';
    } else if (!proofHashMatches) {
      status = 'proof_hash_mismatch';
      reason = 'Proof hash mismatch';
    } else if (expired) {
      status = 'expired';
      reason = 'Credential expired';
    } else if (revoked) {
      status = 'revoked';
      reason = 'Credential revoked';
    }

    const valid = status === 'valid';
    const audit = await writeAuditEvent({
      eventType: 'VERIFY_PRESENTATION',
      subjectId: externalId,
      metadata: {
        nonce,
        audience,
        privacyMode: !!privacyMode,
        disclosureType,
        status,
        signatureValid,
        signatureError,
        expired,
        revoked,
        proofHash,
        proofHashMatches,
      },
    });

    return res.status(200).json({
      valid,
      status,
      proofHash,
      auditRef: audit.hash,
      issuer: issuerName,
      issuedDate: issuedAt,
      expiryDate,
      reason,
    });
  },
);

app.get('/credentials/:id/receipt', async (req, res) => {
  const rawId = String(req.params.id || '').trim();
  if (!rawId) return res.status(400).json({ error: 'credentialId is required' });

  let resolvedId = rawId;
  let jwtArtifact: string | null = null;
  if (isJwtLike(rawId)) {
    jwtArtifact = rawId;
    const payload = decodeJwtPayload(rawId);
    const payloadId = extractCredentialIdFromPayload(payload);
    if (payloadId) resolvedId = payloadId;
  }

  const { externalId } = normalizeCredentialId(resolvedId);
  if (!externalId) return res.status(400).json({ error: 'credentialId is required' });

  const issuanceEvent = await prisma.auditEvent.findFirst({
    where: { type: 'ISSUE_CREDENTIAL', credentialId: externalId },
    orderBy: { createdAt: 'desc' },
  });
  if (!issuanceEvent) return res.status(404).json({ error: 'Receipt not found' });

  const issuanceMetadata = (issuanceEvent.metadata as Record<string, any>) ?? {};
  const storedJwt = issuanceMetadata.jwt ? String(issuanceMetadata.jwt) : null;
  if (!jwtArtifact && storedJwt) jwtArtifact = storedJwt;

  const proofHash = issuanceMetadata.proofHash
    ? String(issuanceMetadata.proofHash)
    : jwtArtifact
      ? computeProofHash(jwtArtifact)
      : null;
  const issuerId = resolveIssuerId(issuanceMetadata.issuerId || issuanceMetadata.issuer);
  const subjectId =
    issuanceMetadata.subjectId ||
    issuanceMetadata.subject_id ||
    issuanceMetadata.credentialSubjectId ||
    null;
  const issuedAt = issuanceMetadata.issuedAt || issuanceEvent.createdAt.toISOString();
  const expiresAt = issuanceMetadata.expiresAt || issuanceMetadata.expiryDate || null;

  const events = await prisma.auditEvent.findMany({
    where: {
      credentialId: externalId,
      type: {
        in: ['ISSUE_CREDENTIAL', 'VERIFY_PRESENTATION', 'REVOKE_CREDENTIAL'],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const timeline = events.map((event) => ({
    eventType: event.type,
    createdAt: event.createdAt.toISOString(),
    auditRef: event.hash,
    metadata: event.metadata ?? null,
  }));

  return res.json({
    credential: {
      credentialId: externalId,
      issuerId,
      subjectId,
      jwt: jwtArtifact,
      proofHash,
      issuedAt,
      expiresAt,
    },
    timeline,
  });
});

app.get('/credentials/:id/renewal-info', async (req, res) => {
  const rawId = String(req.params.id || '').trim();
  if (!rawId) return res.status(400).json({ error: 'credentialId is required' });

  const { externalId, dbId } = normalizeCredentialId(rawId);
  if (!externalId) return res.status(400).json({ error: 'credentialId is required' });

  const credential = dbId ? await prisma.credential.findUnique({ where: { id: dbId } }) : null;
  const issuanceEvent = await prisma.auditEvent.findFirst({
    where: { type: 'ISSUE_CREDENTIAL', credentialId: externalId },
    orderBy: { createdAt: 'desc' },
  });
  if (!credential && !issuanceEvent) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  const issuanceMetadata = (issuanceEvent?.metadata as Record<string, any>) ?? {};
  const expiresAt =
    credential?.expiresAt?.toISOString() ||
    issuanceMetadata.expiresAt ||
    issuanceMetadata.expiryDate ||
    null;
  const renewalWindowDays = resolveRenewalWindowDays(
    credential?.renewalWindowDays ?? issuanceMetadata.renewalWindowDays,
  );
  const authorityId = resolveAuthorityId(
    credential?.authorityId || issuanceMetadata.authorityId || issuanceMetadata.issuerId,
    credential?.issuer || issuanceMetadata.issuer,
  );
  const issuerId = resolveIssuerId(issuanceMetadata.issuerId || credential?.issuer || null);
  const subjectId =
    issuanceMetadata.subjectId ||
    issuanceMetadata.subject_id ||
    issuanceMetadata.credentialSubjectId ||
    null;
  const issuedAt =
    issuanceMetadata.issuedAt ||
    credential?.issuedAt.toISOString() ||
    issuanceEvent?.createdAt.toISOString() ||
    null;

  const lifecycle = evaluateLifecycle(expiresAt, renewalWindowDays);

  try {
    const lifecycleAudit = await writeAuditEvent({
      eventType: 'LIFECYCLE_CHECK',
      subjectId: externalId,
      metadata: {
        credentialId: externalId,
        issuerId,
        subjectId,
        authorityId,
        expiresAt,
        renewalWindowDays,
        daysRemaining: lifecycle.daysRemaining,
        currentState: lifecycle.currentState,
      },
    });

    let renewalWindowAudit: { auditRef: string; created: boolean } | null = null;
    let expiringPulse: { auditRef: string; created: boolean } | null = null;
    let expiredAudit: { auditRef: string; created: boolean } | null = null;

    if (lifecycle.currentState === 'RENEWAL_WINDOW') {
      renewalWindowAudit = await ensureAuditEventOnce('RENEWAL_WINDOW_OPEN', externalId, {
        daysRemaining: lifecycle.daysRemaining,
        renewalWindowDays,
        expiresAt,
      });
      expiringPulse = await ensureAuditEventOnce('CREDENTIAL_EXPIRING_SOON', externalId, {
        daysRemaining: lifecycle.daysRemaining,
        renewalWindowDays,
        expiresAt,
      });
    }

    if (lifecycle.currentState === 'EXPIRED') {
      expiredAudit = await ensureAuditEventOnce('CREDENTIAL_EXPIRED', externalId, {
        expiresAt,
      });
    }

    const authorityGuide = resolveAuthorityGuide(authorityId);

    return res.json({
      credentialId: externalId,
      lifecycle: {
        daysRemaining: lifecycle.daysRemaining,
        currentState: lifecycle.currentState,
        renewalWindowDays,
        expiresAt,
      },
      renewalGuidance: {
        authorityId,
        renewalUrl: authorityGuide.renewalUrl,
        contactEmail: authorityGuide.contactEmail ?? null,
        contactPhone: authorityGuide.contactPhone ?? null,
        renewalSteps: authorityGuide.renewalSteps,
      },
      auditRef: lifecycleAudit.hash,
      pulseEvents: {
        renewalWindowOpen: renewalWindowAudit?.auditRef ?? null,
        credentialExpiringSoon: expiringPulse?.auditRef ?? null,
        credentialExpired: expiredAudit?.auditRef ?? null,
      },
      issuedAt,
      issuerId,
      subjectId,
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append lifecycle audit event',
      detail: String(error instanceof Error ? error.message : error),
    });
  }
});

// Compatibility status endpoints used by the frontend client
app.get(
  ['/status/:credentialId', '/verifier/credential/:credentialId/status'],
  async (req, res) => {
    const { credentialId } = req.params;
    const { externalId, dbId } = normalizeCredentialId(credentialId);
    if (!externalId) return res.status(400).json({ error: 'Credential ID is required' });

    const credential = dbId ? await prisma.credential.findUnique({ where: { id: dbId } }) : null;
    if (!credential) return res.status(404).json({ credentialId: externalId, status: 'unknown' });

    const lastRevoke = await prisma.auditEvent.findFirst({
      where: { type: 'REVOKE_CREDENTIAL', credentialId: externalId },
      orderBy: { createdAt: 'desc' },
    });

    const status = lastRevoke ? 'revoked' : 'valid';
    return res.json({
      credentialId: externalId,
      status,
      issuer: credential.issuer,
      issuedDate: credential.issuedAt.toISOString(),
      lastUpdated: new Date().toISOString(),
      auditRef: lastRevoke?.hash ?? undefined,
      statusReason: lastRevoke ? 'Credential revoked' : undefined,
    });
  },
);

// Existing placeholder endpoint (kept for backwards compatibility)
app.post(
  '/credentials',
  body('name').isString().withMessage('name must be a string'),
  body('issuer').isString().withMessage('issuer must be a string'),
  validateRequest,
  (_req: Request, res: Response) => {
    res.json({ message: 'Credential created' });
  },
);

app.use(errorHandler);

export default app;
