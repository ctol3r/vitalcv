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

const DEFAULT_AUDIT_BATCH_WINDOW_MINUTES = Number(
  process.env.AUDIT_BATCH_WINDOW_MINUTES || 60,
);
const AUDIT_BATCH_EXCLUDED_TYPES = new Set([
  'PROOF_BATCH_ANCHORED',
  'PUBLIC_PROOF_VERIFIED',
]);
const ANY_CREDENTIAL_REQUIREMENT = 'ANY_CREDENTIAL';
const JOB_REQUIREMENTS: Record<string, string[]> = {
  nurse: ['Nursing License'],
  pharmacist: ['Pharmacy Certification'],
  physician: ['Medical License'],
};

type LifecycleState = 'ACTIVE' | 'RENEWAL_WINDOW' | 'EXPIRED';

type BatchWindow = {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
};

type AnchorReceipt = {
  chain: string;
  txId: string;
  timestamp: string;
};

type CredentialLifecycle = {
  externalId: string;
  name: string;
  daysRemaining: number | null;
  currentState: LifecycleState;
  revoked: boolean;
};

type EvidenceLink = {
  publicationId: string | null;
  credentialId: string | null;
  jobId: string | null;
  source: 'DISCOVER' | 'PUBMED';
  discoverItemId?: number;
};

type ReadinessSnapshot = {
  status: 'READY' | 'ALMOST_READY' | 'NOT_READY';
  satisfiedCount: number;
  requiredCount: number;
  evidence: string[];
  generatedAt: string;
  evidenceOnly: boolean;
};

type DiscoverImpactType = 'NONE' | 'ELIGIBILITY' | 'READINESS' | 'COMPLIANCE';

const DISCOVER_IMPACT_TYPES = new Set<DiscoverImpactType>([
  'NONE',
  'ELIGIBILITY',
  'READINESS',
  'COMPLIANCE',
]);

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

function resolveBatchWindow(now: Date = new Date()): BatchWindow {
  const windowMinutes =
    Number.isFinite(DEFAULT_AUDIT_BATCH_WINDOW_MINUTES) &&
    DEFAULT_AUDIT_BATCH_WINDOW_MINUTES > 0
      ? DEFAULT_AUDIT_BATCH_WINDOW_MINUTES
      : 60;
  const windowMs = windowMinutes * 60 * 1000;
  const nowMs = now.getTime();
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  const endMs = startMs + windowMs;
  const from = new Date(startMs);
  const to = new Date(endMs);
  return {
    from,
    to,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

function buildAnchorReceipt(merkleRoot: string): AnchorReceipt {
  const chain = String(process.env.ANCHOR_CHAIN || 'noop').trim() || 'noop';
  const txId =
    String(process.env.ANCHOR_TX_ID || '').trim() || merkleRoot.slice(0, 32) || 'noop';
  return {
    chain,
    txId,
    timestamp: new Date().toISOString(),
  };
}

async function loadBatchEvents(window: BatchWindow) {
  const events = await prisma.auditEvent.findMany({
    where: {
      createdAt: {
        gte: window.from,
        lt: window.to,
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return events
    .filter((event) => !AUDIT_BATCH_EXCLUDED_TYPES.has(event.type))
    .sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.hash.localeCompare(b.hash);
    });
}

function computeMerkleRootFromEvents(events: { hash: string }[]): string | null {
  const hashes = events.map((event) => event.hash).filter(Boolean);
  if (!hashes.length) return null;
  return merkleRootHex(hashes);
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

const INTEROP_EVENT_TYPES = new Set([
  'CREDENTIAL_VERIFIED',
  'CREDENTIAL_REVOKED',
  'READINESS_CHANGED',
  'ELIGIBILITY_IMPROVED',
]);

type InteropEventType =
  | 'CREDENTIAL_VERIFIED'
  | 'CREDENTIAL_REVOKED'
  | 'READINESS_CHANGED'
  | 'ELIGIBILITY_IMPROVED';

type InteropEventPayload = {
  version: 'v1';
  eventType: InteropEventType;
  occurredAt: string;
  subject: Record<string, string | null>;
  proof: Record<string, string | null>;
  data?: Record<string, unknown>;
};

function resolveWebhookEncryptionKey(): Buffer {
  const raw =
    process.env.WEBHOOK_SECRET_KEY ||
    process.env.INTEROP_WEBHOOK_SECRET ||
    process.env.JWT_SECRET ||
    'dev-only-secret';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptWebhookSecret(secret: string): {
  secretCiphertext: string;
  secretIv: string;
  secretTag: string;
} {
  const key = resolveWebhookEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    secretCiphertext: ciphertext.toString('base64'),
    secretIv: iv.toString('base64'),
    secretTag: tag.toString('base64'),
  };
}

function decryptWebhookSecret(record: {
  secretCiphertext: string;
  secretIv: string;
  secretTag: string;
}): string {
  const key = resolveWebhookEncryptionKey();
  const iv = Buffer.from(record.secretIv, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(record.secretTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.secretCiphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function resolveWebhookRetryAttempts(): number {
  const attempts = Number(process.env.WEBHOOK_RETRY_ATTEMPTS || 3);
  return Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 3;
}

function resolveWebhookRetryBaseMs(): number {
  const base = Number(process.env.WEBHOOK_RETRY_BASE_MS || 500);
  return Number.isFinite(base) && base > 0 ? Math.floor(base) : 500;
}

function resolveWebhookOrgId(req: Request, fallback?: string | null): string | null {
  const headerOrg = String(req.headers['x-org-id'] || '').trim();
  const employerId = resolveEmployerId(req);
  const candidate = String(fallback || '').trim() || headerOrg || employerId || '';
  return candidate ? candidate : null;
}

function normalizeInteropEventTypes(input: unknown): InteropEventType[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : [input];
  const normalized = raw
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const result: InteropEventType[] = [];
  for (const value of normalized) {
    if (INTEROP_EVENT_TYPES.has(value)) {
      result.push(value as InteropEventType);
    }
  }
  return Array.from(new Set(result));
}

function serializeWebhookSubscription(record: {
  id: number | string;
  eventType: string;
  targetUrl: string;
  orgId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    eventType: record.eventType,
    targetUrl: record.targetUrl,
    orgId: record.orgId ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function computeWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string,
  nonce: string,
): string {
  const base = `${timestamp}.${nonce}.${payload}`;
  return crypto.createHmac('sha256', secret).update(base).digest('hex');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendSignedWebhook(params: {
  subscription: {
    id: number | string;
    eventType: string;
    targetUrl: string;
    orgId?: string | null;
    secretCiphertext: string;
    secretIv: string;
    secretTag: string;
  };
  payload: InteropEventPayload;
}): Promise<{ ok: boolean; status?: number; attempts: number }> {
  const { subscription, payload } = params;
  const payloadString = JSON.stringify(payload);
  const payloadHash = sha256Hex(payloadString);
  const secret = decryptWebhookSecret(subscription);
  const deliveryId = crypto.randomUUID();
  const maxAttempts = resolveWebhookRetryAttempts();
  const baseDelayMs = resolveWebhookRetryBaseMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = computeWebhookSignature(payloadString, secret, timestamp, nonce);

    await writeAuditEvent({
      eventType: 'WEBHOOK_DELIVERY_ATTEMPTED',
      subjectId: `webhook:${subscription.id}`,
      metadata: {
        deliveryId,
        subscriptionId: subscription.id,
        eventType: subscription.eventType,
        targetUrl: subscription.targetUrl,
        orgId: subscription.orgId ?? null,
        attempt,
        timestamp,
        nonce,
        payloadHash,
      },
    });

    try {
      const response = await fetch(subscription.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Nonce': nonce,
          'X-Webhook-Event': subscription.eventType,
          'X-Webhook-Delivery': deliveryId,
        },
        body: payloadString,
      });

      if (response.ok) {
        await writeAuditEvent({
          eventType: 'WEBHOOK_DELIVERY_SUCCEEDED',
          subjectId: `webhook:${subscription.id}`,
          metadata: {
            deliveryId,
            subscriptionId: subscription.id,
            eventType: subscription.eventType,
            targetUrl: subscription.targetUrl,
            orgId: subscription.orgId ?? null,
            attempt,
            status: response.status,
            payloadHash,
            timestamp,
          },
        });
        return { ok: true, status: response.status, attempts: attempt };
      }

      if (attempt === maxAttempts) {
        await writeAuditEvent({
          eventType: 'WEBHOOK_DELIVERY_FAILED',
          subjectId: `webhook:${subscription.id}`,
          metadata: {
            deliveryId,
            subscriptionId: subscription.id,
            eventType: subscription.eventType,
            targetUrl: subscription.targetUrl,
            orgId: subscription.orgId ?? null,
            attempt,
            status: response.status,
            payloadHash,
            timestamp,
          },
        });
        return { ok: false, status: response.status, attempts: attempt };
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        await writeAuditEvent({
          eventType: 'WEBHOOK_DELIVERY_FAILED',
          subjectId: `webhook:${subscription.id}`,
          metadata: {
            deliveryId,
            subscriptionId: subscription.id,
            eventType: subscription.eventType,
            targetUrl: subscription.targetUrl,
            orgId: subscription.orgId ?? null,
            attempt,
            payloadHash,
            timestamp,
            error: String(error instanceof Error ? error.message : error),
          },
        });
        return { ok: false, attempts: attempt };
      }
    }

    const delayMs = baseDelayMs * 2 ** (attempt - 1);
    await sleep(delayMs);
  }

  return { ok: false, attempts: maxAttempts };
}

async function dispatchInteropWebhookEvent(
  payload: InteropEventPayload,
  orgId?: string | null,
): Promise<{ delivered: number; failed: number }> {
  const subscriptionModel = (prisma as any).webhookSubscription;
  if (!subscriptionModel) return { delivered: 0, failed: 0 };

  const where: Record<string, unknown> = {
    eventType: payload.eventType,
    isActive: true,
  };
  if (orgId) {
    where.OR = [{ orgId }, { orgId: null }];
  } else {
    where.orgId = null;
  }

  const subscriptions = await subscriptionModel.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (!subscriptions.length) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    const result = await sendSignedWebhook({ subscription, payload });
    if (result.ok) {
      delivered += 1;
    } else {
      failed += 1;
    }
  }

  return { delivered, failed };
}

function resolveAuthorityGuide(authorityId: string | null) {
  if (!authorityId) return AUTHORITY_RENEWAL_GUIDES.DEFAULT;
  return AUTHORITY_RENEWAL_GUIDES[authorityId] || AUTHORITY_RENEWAL_GUIDES.DEFAULT;
}

function normalizeJobKey(value?: string | null): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized ? normalized : null;
}

function resolveJobRequirements(jobId: string, jobTitle?: string | null): string[] {
  const jobKeys = [normalizeJobKey(jobId), normalizeJobKey(jobTitle)].filter(
    (value): value is string => Boolean(value),
  );
  for (const key of jobKeys) {
    if (JOB_REQUIREMENTS[key]?.length) return JOB_REQUIREMENTS[key];
  }
  return [ANY_CREDENTIAL_REQUIREMENT];
}

function resolveEmployerId(req: Request): string | null {
  const headerId = String(req.headers['x-employer-id'] || '').trim();
  const queryId = String(req.query.employerId || '').trim();
  const candidate = headerId || queryId;
  return candidate ? candidate : null;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function resolveImpactType(value: unknown): DiscoverImpactType {
  const normalized = String(value || '').trim().toUpperCase();
  if (DISCOVER_IMPACT_TYPES.has(normalized as DiscoverImpactType)) {
    return normalized as DiscoverImpactType;
  }
  return 'NONE';
}

function buildEvidenceIds(evidenceLinks: EvidenceLink[]): string[] {
  const evidenceSet = new Set<string>();
  for (const link of evidenceLinks) {
    if (link.credentialId) evidenceSet.add(link.credentialId);
    if (link.publicationId) evidenceSet.add(`PUBMED:${link.publicationId}`);
  }
  return Array.from(evidenceSet);
}

function evidenceMatchesRequirement(
  requirement: string,
  jobId: string,
  link: EvidenceLink,
  credentialByExternalId: Map<string, { name: string }>,
): boolean {
  if (requirement === ANY_CREDENTIAL_REQUIREMENT) {
    return Boolean(link.publicationId || link.credentialId || link.jobId === jobId);
  }
  if (link.credentialId) {
    const credential = credentialByExternalId.get(link.credentialId);
    if (credential && credential.name.toLowerCase() === requirement.toLowerCase()) return true;
    if (link.credentialId.toLowerCase() === requirement.toLowerCase()) return true;
  }
  if (link.jobId && link.jobId === jobId) return true;
  return false;
}

async function buildReadinessSnapshot(
  clinician: { id: number },
  clinicianKey: string,
  jobId: string,
  jobTitle: string,
): Promise<ReadinessSnapshot> {
  const requirements = resolveJobRequirements(jobId, jobTitle);
  const requiredCount = requirements.length;

  const credentials = await prisma.credential.findMany({
    where: { userId: clinician.id },
    orderBy: { issuedAt: 'asc' },
  });
  const externalIds = credentials.map((credential) => `CRED-${credential.id}`);
  const revokedEvents = externalIds.length
    ? await prisma.auditEvent.findMany({
        where: { type: 'REVOKE_CREDENTIAL', credentialId: { in: externalIds } },
        select: { credentialId: true },
      })
    : [];
  const revokedSet = new Set(revokedEvents.map((event) => event.credentialId).filter(Boolean));

  const credentialByExternalId = new Map<string, { name: string; currentState: LifecycleState }>();
  for (const credential of credentials) {
    const expiresAt = credential.expiresAt ? credential.expiresAt.toISOString() : null;
    const renewalWindowDays = resolveRenewalWindowDays(credential.renewalWindowDays);
    const lifecycle = evaluateLifecycle(expiresAt, renewalWindowDays);
    const externalId = `CRED-${credential.id}`;
    if (!revokedSet.has(externalId) && lifecycle.currentState !== 'EXPIRED') {
      credentialByExternalId.set(externalId, {
        name: credential.name,
        currentState: lifecycle.currentState,
      });
    }
  }

  const discoverItems = await prisma.discoverItem.findMany({
    where: { clinicianId: clinicianKey },
    orderBy: { createdAt: 'asc' },
  });
  const pubmedEvidence = await prisma.pubMedEvidence.findMany({
    where: { clinicianId: clinicianKey },
    orderBy: { createdAt: 'asc' },
  });

  const evidenceLinks: EvidenceLink[] = [];
  for (const item of discoverItems) {
    const impactType = String(item.impactType || '').toUpperCase();
    if (impactType === 'NONE') continue;
    const impactedJobs = parseStringArray(item.impactedJobIds);
    const impactedCreds = parseStringArray(item.impactedCredentialIds);
    const jobMatches = impactedJobs.includes(jobId);
    if (!jobMatches && impactedCreds.length === 0) continue;
    const publicationId = item.publicationId ? String(item.publicationId) : null;
    if (publicationId) {
      evidenceLinks.push({
        publicationId,
        credentialId: null,
        jobId: jobMatches ? jobId : null,
        source: 'DISCOVER',
        discoverItemId: item.id,
      });
    }
    for (const credentialId of impactedCreds) {
      evidenceLinks.push({
        publicationId,
        credentialId,
        jobId: jobMatches ? jobId : null,
        source: 'DISCOVER',
        discoverItemId: item.id,
      });
    }
  }

  for (const link of pubmedEvidence) {
    if (link.jobId && link.jobId !== jobId && !link.credentialId) continue;
    evidenceLinks.push({
      publicationId: link.publicationId,
      credentialId: link.credentialId ?? null,
      jobId: link.jobId ?? null,
      source: 'PUBMED',
    });
  }

  const evidenceSet = new Set<string>();
  let satisfiedCount = 0;
  let missingRequirement = false;
  let evidenceOnly = false;

  for (const requirement of requirements) {
    const credentialMatches = Array.from(credentialByExternalId.entries()).filter((entry) => {
      const [, credential] = entry;
      if (requirement === ANY_CREDENTIAL_REQUIREMENT) return true;
      return credential.name.toLowerCase() === requirement.toLowerCase();
    });
    const evidenceMatches = evidenceLinks.filter((link) =>
      evidenceMatchesRequirement(requirement, jobId, link, credentialByExternalId),
    );

    if (credentialMatches.length) {
      satisfiedCount += 1;
      credentialMatches.forEach(([externalId]) => evidenceSet.add(externalId));
      buildEvidenceIds(evidenceMatches).forEach((id) => evidenceSet.add(id));
      continue;
    }

    if (evidenceMatches.length) {
      satisfiedCount += 1;
      evidenceOnly = true;
      buildEvidenceIds(evidenceMatches).forEach((id) => evidenceSet.add(id));
      continue;
    }

    missingRequirement = true;
  }

  let status: 'READY' | 'ALMOST_READY' | 'NOT_READY' = 'READY';
  if (missingRequirement) {
    status = 'NOT_READY';
  } else if (evidenceOnly) {
    status = 'ALMOST_READY';
  }

  return {
    status,
    satisfiedCount,
    requiredCount,
    evidence: Array.from(evidenceSet).sort(),
    generatedAt: new Date().toISOString(),
    evidenceOnly,
  };
}

function readinessRank(status: 'READY' | 'ALMOST_READY' | 'NOT_READY'): number {
  if (status === 'READY') return 2;
  if (status === 'ALMOST_READY') return 1;
  return 0;
}

function resolveReadinessImprovement(before: ReadinessSnapshot, after: ReadinessSnapshot) {
  const beforeRank = readinessRank(before.status);
  const afterRank = readinessRank(after.status);
  if (afterRank <= beforeRank) return null;
  if (after.status === 'READY') return 'READINESS_IMPROVED';
  return 'ELIGIBILITY_IMPROVED';
}

function resolveJobsFromCredentialNames(names: string[]): string[] {
  const normalized = names.map((name) => name.toLowerCase());
  const jobIds = new Set<string>();
  for (const [jobKey, requirements] of Object.entries(JOB_REQUIREMENTS)) {
    if (requirements.some((req) => normalized.includes(req.toLowerCase()))) {
      jobIds.add(jobKey);
    }
  }
  return Array.from(jobIds);
}

async function emitEligibilityImpactEvents(params: {
  clinicianKey: string;
  jobId: string;
  before: ReadinessSnapshot;
  after: ReadinessSnapshot;
  discoverItemId?: number;
  publicationId?: string;
  affectedJobIds: string[];
}) {
  const pulseType = resolveReadinessImprovement(params.before, params.after);
  if (!pulseType) return null;

  const changeAudit = await writeAuditEvent({
    eventType: 'ELIGIBILITY_CHANGED',
    subjectId: `eligibility:${params.clinicianKey}:${params.jobId}`,
    metadata: {
      clinicianId: params.clinicianKey,
      jobId: params.jobId,
      affectedJobIds: params.affectedJobIds,
      discoverItemId: params.discoverItemId ?? null,
      publicationId: params.publicationId ?? null,
      beforeStatus: params.before.status,
      afterStatus: params.after.status,
      generatedAt: params.after.generatedAt,
    },
  });

  await ensureAuditEventOnce(pulseType, `pulse:${params.clinicianKey}:${params.jobId}`, {
    clinicianId: params.clinicianKey,
    jobId: params.jobId,
    affectedJobIds: params.affectedJobIds,
    discoverItemId: params.discoverItemId ?? null,
    publicationId: params.publicationId ?? null,
    beforeStatus: params.before.status,
    afterStatus: params.after.status,
    generatedAt: params.after.generatedAt,
  });

  const proof = {
    auditRef: changeAudit.hash,
    publicationId: params.publicationId ?? null,
    discoverItemId: params.discoverItemId ? String(params.discoverItemId) : null,
  };

  await dispatchInteropWebhookEvent({
    version: 'v1',
    eventType: 'READINESS_CHANGED',
    occurredAt: params.after.generatedAt,
    subject: {
      clinicianId: params.clinicianKey,
      jobId: params.jobId,
    },
    proof,
    data: {
      beforeStatus: params.before.status,
      afterStatus: params.after.status,
      affectedJobIds: params.affectedJobIds,
      generatedAt: params.after.generatedAt,
    },
  });

  await dispatchInteropWebhookEvent({
    version: 'v1',
    eventType: 'ELIGIBILITY_IMPROVED',
    occurredAt: params.after.generatedAt,
    subject: {
      clinicianId: params.clinicianKey,
      jobId: params.jobId,
    },
    proof,
    data: {
      improvementType: pulseType,
      beforeStatus: params.before.status,
      afterStatus: params.after.status,
      affectedJobIds: params.affectedJobIds,
      generatedAt: params.after.generatedAt,
    },
  });

  return changeAudit.hash;
}

function normalizeBatchWindow(window: BatchWindow) {
  return {
    from: window.fromIso,
    to: window.toIso,
  };
}

function parseAnchorReceipt(input?: Record<string, unknown> | null): AnchorReceipt | null {
  if (!input) return null;
  const chain = typeof input.chain === 'string' ? input.chain : null;
  const txId = typeof input.txId === 'string' ? input.txId : null;
  const timestamp = typeof input.timestamp === 'string' ? input.timestamp : null;
  if (!chain || !txId || !timestamp) return null;
  return { chain, txId, timestamp };
}

function parseAnchoredBatch(event: { metadata: unknown; createdAt: Date }) {
  const metadata = event.metadata as Record<string, any> | null;
  if (!metadata) return null;
  const merkleRoot = typeof metadata.merkleRoot === 'string' ? metadata.merkleRoot : null;
  const batchWindow = metadata.batchWindow as { from?: string; to?: string } | undefined;
  if (!merkleRoot || !batchWindow?.from || !batchWindow?.to) return null;
  const anchorReceipt = parseAnchorReceipt(metadata.anchorReceipt);
  return {
    merkleRoot,
    batchWindow: { from: batchWindow.from, to: batchWindow.to },
    anchorReceipt,
    anchoredAt: anchorReceipt?.timestamp || event.createdAt.toISOString(),
  };
}

async function findAnchoredBatchByRoot(merkleRoot: string) {
  const anchors = await prisma.auditEvent.findMany({
    where: { type: 'PROOF_BATCH_ANCHORED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  for (const anchor of anchors) {
    const parsed = parseAnchoredBatch(anchor);
    if (parsed && parsed.merkleRoot === merkleRoot) {
      return parsed;
    }
  }
  return null;
}

async function findAnchoredBatchByWindow(window: BatchWindow) {
  const anchors = await prisma.auditEvent.findMany({
    where: { type: 'PROOF_BATCH_ANCHORED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  for (const anchor of anchors) {
    const parsed = parseAnchoredBatch(anchor);
    if (parsed && parsed.batchWindow.from === window.fromIso && parsed.batchWindow.to === window.toIso) {
      return parsed;
    }
  }
  return null;
}

async function ensureBatchAnchor(window: BatchWindow) {
  const existing = await findAnchoredBatchByWindow(window);
  if (existing) return existing;
  const events = await loadBatchEvents(window);
  const merkleRoot = computeMerkleRootFromEvents(events);
  if (!merkleRoot) return null;
  const anchorReceipt = buildAnchorReceipt(merkleRoot);
  const audit = await writeAuditEvent({
    eventType: 'PROOF_BATCH_ANCHORED',
    subjectId: `batch:${window.fromIso}`,
    metadata: {
      merkleRoot,
      batchWindow: normalizeBatchWindow(window),
      anchorReceipt,
    },
  });
  return {
    merkleRoot,
    batchWindow: normalizeBatchWindow(window),
    anchorReceipt,
    anchoredAt: anchorReceipt.timestamp || audit.createdAt,
  };
}

function resolveOnStatusBaseUrl(): string {
  const configured = String(process.env.ON_STATUS_BASE_URL || process.env.SELF_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const port = process.env.PORT || 4000;
  return `http://127.0.0.1:${port}`;
}

function parseEnvFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function hasMockFlags(): boolean {
  const flags = ['MOCK_MODE', 'ENABLE_MOCKS', 'USE_MOCKS', 'MOCK_ENDPOINTS'];
  return flags.some((flag) => parseEnvFlag(process.env[flag]));
}

async function checkEndpoint(baseUrl: string, path: string) {
  const url = `${baseUrl}${path}`;
  try {
    const timeoutMs = Number(process.env.ON_STATUS_TIMEOUT_MS || 1200);
    const response = await withTimeout(fetch(url, { method: 'GET' }), timeoutMs, path);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.message : error) };
  }
}

async function verifyAuditAppend(eventType: string, metadata: Record<string, unknown>) {
  try {
    const audit = await writeAuditEvent({ eventType, subjectId: 'system:on-status', metadata });
    const found = await prisma.auditEvent.findFirst({ where: { hash: audit.hash } });
    if (!found) throw new Error('audit_event_not_found');
    return { ok: true, hash: audit.hash };
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.message : error) };
  }
}

async function getLastAuditRoot(): Promise<string | null> {
  const anchor = await prisma.auditEvent.findFirst({
    where: { type: 'PROOF_BATCH_ANCHORED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!anchor) return null;
  const parsed = parseAnchoredBatch(anchor);
  return parsed?.merkleRoot ?? null;
}

async function evaluateOnStatus(baseUrl: string) {
  const checkedAt = new Date().toISOString();
  const blockingReasons: string[] = [];
  let criticalFailure = false;

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    blockingReasons.push('DATABASE_URL missing');
    criticalFailure = true;
  }

  if (parseEnvFlag(process.env.DEMO_MODE)) {
    blockingReasons.push('DEMO_MODE enabled');
  }

  if (hasMockFlags()) {
    blockingReasons.push('mock_endpoints_enabled');
  }

  const ledgerAdapter = String(
    process.env.LEDGER_ADAPTER || process.env.ANCHOR_CHAIN || '',
  ).trim();
  const ledgerEnabled = Boolean(ledgerAdapter && ledgerAdapter !== 'noop');
  if (!ledgerEnabled) {
    blockingReasons.push('ledger_adapter_missing');
  }

  const [health, healthz, readyz] = await Promise.all([
    checkEndpoint(baseUrl, '/health'),
    checkEndpoint(baseUrl, '/healthz'),
    checkEndpoint(baseUrl, '/readyz'),
  ]);
  if (!health.ok) {
    blockingReasons.push('health_failed');
    criticalFailure = true;
  }
  if (!healthz.ok) {
    blockingReasons.push('healthz_failed');
    criticalFailure = true;
  }
  if (!readyz.ok) {
    blockingReasons.push('readyz_failed');
    criticalFailure = true;
  }

  const verifierPing = await checkEndpoint(
    baseUrl,
    '/verify/public?proofHash=ping&merkleRoot=ping',
  );
  const verifierReachable = verifierPing.ok || verifierPing.status === 400;
  if (!verifierReachable) {
    blockingReasons.push('public_verifier_unreachable');
  }

  const status = criticalFailure
    ? 'OFF'
    : blockingReasons.length
      ? 'SOFT_ON'
      : 'HARD_ON';

  return {
    status,
    blockingReasons,
    checkedAt,
    dependencies: {
      db: health.ok,
      audit: healthz.ok,
      ledger: { enabled: ledgerEnabled, adapter: ledgerAdapter || null },
    },
    checks: {
      boot: true,
      health: health.ok,
      healthz: healthz.ok,
      readyz: readyz.ok,
      ledger: ledgerEnabled,
      verifier: verifierReachable,
    },
  };
}

async function getSystemOnStatus(baseUrl: string) {
  const onStatus = await evaluateOnStatus(baseUrl);
  const auditCheck = await verifyAuditAppend('SYSTEM_ON_CHECKED', {
    status: onStatus.status,
    blockingReasons: onStatus.blockingReasons,
    checkedAt: onStatus.checkedAt,
    dependencies: onStatus.dependencies,
  });
  return { onStatus, auditCheck };
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

app.get('/system/on-status', async (_req, res) => {
  const baseUrl = resolveOnStatusBaseUrl();
  const { onStatus, auditCheck } = await getSystemOnStatus(baseUrl);

  if (!auditCheck.ok) {
    return res.status(503).json({
      status: 'OFF',
      blockingReasons: [...onStatus.blockingReasons, 'audit_append_failed'],
      checkedAt: onStatus.checkedAt,
      error: auditCheck.error,
    });
  }

  return res.json({
    status: onStatus.status,
    blockingReasons: onStatus.blockingReasons,
    checkedAt: onStatus.checkedAt,
  });
});

app.get('/status', async (req, res) => {
  const baseUrl = resolveOnStatusBaseUrl();
  const { onStatus, auditCheck } = await getSystemOnStatus(baseUrl);
  if (!auditCheck.ok) {
    return res.status(503).json({
      error: 'Failed to append system on-status audit',
      detail: auditCheck.error,
    });
  }
  const lastAuditRoot = await getLastAuditRoot();

  const statusPayload = {
    onStatus: {
      status: onStatus.status,
      blockingReasons: onStatus.blockingReasons,
      checkedAt: onStatus.checkedAt,
    },
    lastAuditRoot,
    buildInfo: {
      sha: gitSha,
      time: builtAtIso,
    },
    dependencies: {
      db: onStatus.dependencies.db,
      audit: onStatus.dependencies.audit,
      ledger: onStatus.dependencies.ledger,
    },
  };

  try {
    const audit = await writeAuditEvent({
      eventType: 'STATUS_VIEWED',
      subjectId: 'system:status',
      metadata: {
        onStatus: statusPayload.onStatus,
        lastAuditRoot,
        buildInfo: statusPayload.buildInfo,
        dependencies: statusPayload.dependencies,
        employerId: resolveEmployerId(req),
      },
    });
    return res.json({ ...statusPayload, auditRef: audit.hash });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append status audit event',
      detail: String(error instanceof Error ? error.message : error),
    });
  }
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

app.get('/interop/credentials/:clinicianId', async (req, res) => {
  const clinicianIdInput = String(req.params.clinicianId || '').trim();
  if (!clinicianIdInput) {
    return res.status(400).json({ error: 'clinicianId is required' });
  }

  const clinicianNumericId = Number(clinicianIdInput);
  const clinician = Number.isFinite(clinicianNumericId)
    ? await prisma.user.findUnique({ where: { id: clinicianNumericId } })
    : await prisma.user.findUnique({ where: { email: clinicianIdInput } });
  if (!clinician) {
    return res.status(404).json({ error: 'Clinician not found' });
  }

  const credentials = await prisma.credential.findMany({
    where: { userId: clinician.id },
    orderBy: { issuedAt: 'desc' },
  });
  const externalIds = credentials.map((credential) => `CRED-${credential.id}`);

  const [issuanceEvents, revokeEvents, lastAuditRoot] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { type: 'ISSUE_CREDENTIAL', credentialId: { in: externalIds } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditEvent.findMany({
      where: { type: 'REVOKE_CREDENTIAL', credentialId: { in: externalIds } },
      select: { credentialId: true },
    }),
    getLastAuditRoot(),
  ]);

  const proofHashByCredential = new Map<string, string | null>();
  for (const event of issuanceEvents) {
    const credentialId = event.credentialId ? String(event.credentialId) : '';
    if (!credentialId || proofHashByCredential.has(credentialId)) continue;
    const metadata = event.metadata as Record<string, any> | null;
    const proofHash = metadata?.proofHash ? String(metadata.proofHash) : null;
    proofHashByCredential.set(credentialId, proofHash);
  }

  const revoked = new Set(
    revokeEvents.map((event) => event.credentialId).filter(Boolean) as string[],
  );
  const nowMs = Date.now();
  const generatedAt = new Date().toISOString();

  try {
    const audit = await writeAuditEvent({
      eventType: 'INTEROP_EXPORT_GENERATED',
      subjectId: `clinician:${clinician.id}`,
      metadata: {
        clinicianId: String(clinician.id),
        credentialCount: credentials.length,
        generatedAt,
        lastAuditRoot,
      },
    });

    return res.json({
      version: 'v1',
      generatedAt,
      lastAuditRoot,
      credentials: credentials.map((credential) => {
        const externalId = `CRED-${credential.id}`;
        const expiresAt = credential.expiresAt
          ? credential.expiresAt.toISOString()
          : null;
        const isExpired = credential.expiresAt
          ? credential.expiresAt.getTime() <= nowMs
          : false;
        const status = revoked.has(externalId)
          ? 'revoked'
          : isExpired
            ? 'expired'
            : 'active';
        return {
          id: externalId,
          issuer: credential.issuer,
          status,
          issuedAt: credential.issuedAt.toISOString(),
          expiresAt,
          proofHash: proofHashByCredential.get(externalId) ?? null,
        };
      }),
      auditRef: audit.hash,
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append interop export audit event',
      detail: String(error instanceof Error ? error.message : error),
    });
  }
});

app.post(
  '/interop/webhooks',
  body('targetUrl').isString().withMessage('targetUrl is required'),
  body('secret').isString().withMessage('secret is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const targetUrlInput = String(req.body?.targetUrl || '').trim();
    const secret = String(req.body?.secret || '').trim();
    const orgIdInput = String(req.body?.orgId || '').trim();
    const eventTypes = normalizeInteropEventTypes(
      req.body?.eventTypes ?? req.body?.eventType,
    );

    if (!eventTypes.length) {
      return res.status(400).json({
        error: 'eventTypes is required',
        allowed: Array.from(INTEROP_EVENT_TYPES),
      });
    }

    let normalizedUrl: string;
    try {
      const parsed = new URL(targetUrlInput);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'targetUrl must be http or https' });
      }
      normalizedUrl = parsed.toString();
    } catch {
      return res.status(400).json({ error: 'Invalid targetUrl' });
    }

    const orgId = resolveWebhookOrgId(req, orgIdInput);
    const encrypted = encryptWebhookSecret(secret);
    const secretHash = sha256Hex(secret);

    const subscriptionModel = (prisma as any).webhookSubscription;
    const created: any[] = [];

    try {
      for (const eventType of eventTypes) {
        const createdRecord = await subscriptionModel.create({
          data: {
            eventType,
            targetUrl: normalizedUrl,
            orgId,
            secretHash,
            secretCiphertext: encrypted.secretCiphertext,
            secretIv: encrypted.secretIv,
            secretTag: encrypted.secretTag,
            isActive: true,
          },
        });
        created.push(createdRecord);
      }
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to register webhook',
        detail: String(error instanceof Error ? error.message : error),
      });
    }

    try {
      const audit = await writeAuditEvent({
        eventType: 'WEBHOOK_REGISTERED',
        subjectId: orgId ? `org:${orgId}` : 'interop:webhook',
        metadata: {
          subscriptionIds: created.map((record) => record.id),
          eventTypes,
          targetUrl: normalizedUrl,
          orgId,
        },
      });

      return res.status(201).json({
        webhooks: created.map((record) =>
          serializeWebhookSubscription({
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          }),
        ),
        auditRef: audit.hash,
      });
    } catch (error) {
      if (created.length) {
        await subscriptionModel.deleteMany({
          where: { id: { in: created.map((record) => record.id) } },
        });
      }
      return res.status(503).json({
        error: 'Failed to append webhook audit event',
        detail: String(error instanceof Error ? error.message : error),
      });
    }
  },
);

app.get('/interop/webhooks', async (req, res) => {
  const orgId = resolveWebhookOrgId(req, String(req.query.orgId || '').trim() || null);
  const includeInactive = ['1', 'true', 'yes'].includes(
    String(req.query.includeInactive || '').trim().toLowerCase(),
  );
  const subscriptionModel = (prisma as any).webhookSubscription;
  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (!includeInactive) where.isActive = true;

  const subscriptions = await subscriptionModel.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    webhooks: subscriptions.map((record: any) =>
      serializeWebhookSubscription({
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      }),
    ),
  });
});

app.delete('/interop/webhooks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }

  const subscriptionModel = (prisma as any).webhookSubscription;
  const existing = await subscriptionModel.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  await subscriptionModel.delete({ where: { id } });
  return res.json({ deleted: true, id });
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

    try {
      await dispatchInteropWebhookEvent(
        {
          version: 'v1',
          eventType: 'CREDENTIAL_REVOKED',
          occurredAt: revokedAt,
          subject: {
            credentialId: externalId,
          },
          proof: {
            proofHash,
            auditRef: audit.hash,
          },
          data: {
            revokedAt,
            reason: reason || null,
          },
        },
        resolveWebhookOrgId(req, null),
      );
    } catch (error) {
      return res.status(503).json({
        error: 'Failed to dispatch interop webhook',
        detail: String(error instanceof Error ? error.message : error),
        auditRef: audit.hash,
      });
    }

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

    if (valid) {
      const subjectIdValue =
        (payload?.sub as string | undefined) ||
        ((payload as Record<string, unknown> | null)?.subjectId as string | undefined) ||
        null;
      try {
        await dispatchInteropWebhookEvent(
          {
            version: 'v1',
            eventType: 'CREDENTIAL_VERIFIED',
            occurredAt: audit.createdAt,
            subject: {
              credentialId: externalId,
              clinicianId: subjectIdValue,
            },
            proof: {
              proofHash,
              auditRef: audit.hash,
            },
            data: {
              status,
              issuer: issuerName,
              issuedAt,
              expiryDate,
              verificationMode: disclosureType ?? null,
            },
          },
          resolveWebhookOrgId(req, null),
        );
      } catch (error) {
        return res.status(503).json({
          error: 'Failed to dispatch interop webhook',
          detail: String(error instanceof Error ? error.message : error),
          auditRef: audit.hash,
        });
      }
    }

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

app.get('/verify/public', async (req, res) => {
  const proofHash = String(req.query.proofHash || '').trim();
  const merkleRoot = String(req.query.merkleRoot || '').trim();
  if (!proofHash || !merkleRoot) {
    return res.status(400).json({ error: 'proofHash and merkleRoot are required' });
  }

  let anchor = await findAnchoredBatchByRoot(merkleRoot);
  if (!anchor) {
    try {
      const window = resolveBatchWindow();
      const events = await loadBatchEvents(window);
      const computedRoot = computeMerkleRootFromEvents(events);
      if (computedRoot && computedRoot === merkleRoot) {
        anchor = await ensureBatchAnchor(window);
      }
    } catch (error) {
      return res.status(503).json({
        error: 'Failed to anchor audit batch',
        detail: String(error instanceof Error ? error.message : error),
      });
    }
  }

  if (!anchor) {
    try {
      const audit = await writeAuditEvent({
        eventType: 'PUBLIC_PROOF_VERIFIED',
        subjectId: `proof:${proofHash}`,
        metadata: {
          proofHash,
          merkleRoot,
          valid: false,
          reason: 'anchor_not_found',
        },
      });
      return res.json({
        valid: false,
        anchoredAt: null,
        batchWindow: null,
        auditRef: audit.hash,
        reason: 'anchor_not_found',
        proof: {
          proofHash,
          merkleRoot,
          anchorReceipt: null,
        },
      });
    } catch (error) {
      return res.status(503).json({
        error: 'Failed to append public verification audit',
        detail: String(error instanceof Error ? error.message : error),
      });
    }
  }

  const window: BatchWindow = {
    from: new Date(anchor.batchWindow.from),
    to: new Date(anchor.batchWindow.to),
    fromIso: anchor.batchWindow.from,
    toIso: anchor.batchWindow.to,
  };
  const events = await loadBatchEvents(window);
  const computedRoot = computeMerkleRootFromEvents(events);
  const rootMatches = computedRoot === merkleRoot;
  const proofFound = events.some((event) => {
    const metadata = event.metadata as Record<string, any> | null;
    return metadata?.proofHash === proofHash;
  });

  let reason: string | undefined;
  if (!rootMatches) {
    reason = 'merkle_root_mismatch';
  } else if (!proofFound) {
    reason = 'proof_not_in_batch';
  }

  const valid = rootMatches && proofFound;
  const proof = {
    proofHash,
    merkleRoot,
    anchorReceipt: anchor.anchorReceipt,
  };

  try {
    const audit = await writeAuditEvent({
      eventType: 'PUBLIC_PROOF_VERIFIED',
      subjectId: `proof:${proofHash}`,
      metadata: {
        proofHash,
        merkleRoot,
        valid,
        reason: reason || null,
        batchWindow: anchor.batchWindow,
        anchoredAt: anchor.anchoredAt,
      },
    });
    return res.json({
      valid,
      anchoredAt: anchor.anchoredAt,
      batchWindow: anchor.batchWindow,
      auditRef: audit.hash,
      reason,
      proof,
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append public verification audit',
      detail: String(error instanceof Error ? error.message : error),
    });
  }
});

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

app.post(
  '/discover/items/classify',
  body('clinicianId').isString().withMessage('clinicianId is required'),
  body('impactType').isString().withMessage('impactType is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      clinicianId,
      impactType,
      publicationId: publicationIdInput,
      impactedCredentialIds: impactedCredentialIdsInput,
      impactedJobIds: impactedJobIdsInput,
    } = req.body as Record<string, any>;

    const clinicianNumericId = Number(clinicianId);
    const clinician = Number.isFinite(clinicianNumericId)
      ? await prisma.user.findUnique({ where: { id: clinicianNumericId } })
      : await prisma.user.findUnique({ where: { email: String(clinicianId) } });
    if (!clinician) {
      return res.status(404).json({ error: 'Clinician not found' });
    }
    const clinicianKey = String(clinician.id);
    const resolvedImpactType = resolveImpactType(impactType);
    const publicationId = publicationIdInput ? String(publicationIdInput).trim() : null;

    const impactedCredentialIdsRaw = parseStringArray(impactedCredentialIdsInput);
    const impactedJobIdsRaw = parseStringArray(impactedJobIdsInput);
    const impactedCredentialIds: string[] = [];
    const credentialDbIds: number[] = [];

    for (const credentialId of impactedCredentialIdsRaw) {
      const normalized = normalizeCredentialId(credentialId);
      if (normalized.externalId) impactedCredentialIds.push(normalized.externalId);
      if (normalized.dbId) credentialDbIds.push(normalized.dbId);
    }

    const impactedCredentials = credentialDbIds.length
      ? await prisma.credential.findMany({
          where: { id: { in: credentialDbIds } },
          select: { name: true },
        })
      : [];
    const derivedJobIds = resolveJobsFromCredentialNames(
      impactedCredentials.map((credential) => credential.name),
    );
    const impactedJobIds = Array.from(new Set([...impactedJobIdsRaw, ...derivedJobIds]));

    const readinessBefore = new Map<string, ReadinessSnapshot>();
    for (const jobId of impactedJobIds) {
      const jobNumericId = Number(jobId);
      const job = Number.isFinite(jobNumericId)
        ? await prisma.job.findUnique({ where: { id: jobNumericId } })
        : null;
      const jobTitle = job?.title || jobId;
      readinessBefore.set(
        jobId,
        await buildReadinessSnapshot(clinician, clinicianKey, jobId, jobTitle),
      );
    }

    const discoverItem = await prisma.discoverItem.create({
      data: {
        clinicianId: clinicianKey,
        publicationId,
        impactType: resolvedImpactType,
        impactedCredentialIds,
        impactedJobIds,
      },
    });

    try {
      const audit = await writeAuditEvent({
        eventType: 'DISCOVER_ITEM_EVALUATED',
        subjectId: `discover:${discoverItem.id}`,
        metadata: {
          discoverItemId: discoverItem.id,
          clinicianId: clinicianKey,
          publicationId,
          impactType: resolvedImpactType,
          impactedCredentialIds,
          impactedJobIds,
        },
      });

      if (resolvedImpactType !== 'NONE' && impactedJobIds.length) {
        for (const jobId of impactedJobIds) {
          const jobNumericId = Number(jobId);
          const job = Number.isFinite(jobNumericId)
            ? await prisma.job.findUnique({ where: { id: jobNumericId } })
            : null;
          const jobTitle = job?.title || jobId;
          const before = readinessBefore.get(jobId);
          if (!before) continue;
          const after = await buildReadinessSnapshot(clinician, clinicianKey, jobId, jobTitle);
          await emitEligibilityImpactEvents({
            clinicianKey,
            jobId,
            before,
            after,
            discoverItemId: discoverItem.id,
            publicationId: publicationId || undefined,
            affectedJobIds: impactedJobIds,
          });
        }
      }

      return res.status(201).json({ discoverItemId: discoverItem.id, auditRef: audit.hash });
    } catch (error) {
      return res.status(503).json({
        error: 'Failed to append discover audit event',
        detail: String(error instanceof Error ? error.message : error),
      });
    }
  },
);

app.post(
  '/pubmed/ingest',
  body('clinicianId').isString().withMessage('clinicianId is required'),
  body('publicationId').isString().withMessage('publicationId is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const {
      clinicianId,
      publicationId: publicationIdInput,
      title,
      impactedCredentialIds: impactedCredentialIdsInput,
      impactedJobIds: impactedJobIdsInput,
    } = req.body as Record<string, any>;

    const clinicianNumericId = Number(clinicianId);
    const clinician = Number.isFinite(clinicianNumericId)
      ? await prisma.user.findUnique({ where: { id: clinicianNumericId } })
      : await prisma.user.findUnique({ where: { email: String(clinicianId) } });
    if (!clinician) {
      return res.status(404).json({ error: 'Clinician not found' });
    }
    const clinicianKey = String(clinician.id);
    const publicationId = String(publicationIdInput).trim();

    const impactedCredentialIdsRaw = parseStringArray(impactedCredentialIdsInput);
    const impactedJobIdsRaw = parseStringArray(impactedJobIdsInput);
    const impactedCredentialIds: string[] = [];
    const credentialDbIds: number[] = [];

    for (const credentialId of impactedCredentialIdsRaw) {
      const normalized = normalizeCredentialId(credentialId);
      if (normalized.externalId) impactedCredentialIds.push(normalized.externalId);
      if (normalized.dbId) credentialDbIds.push(normalized.dbId);
    }

    const impactedCredentials = credentialDbIds.length
      ? await prisma.credential.findMany({
          where: { id: { in: credentialDbIds } },
          select: { name: true },
        })
      : [];
    const derivedJobIds = resolveJobsFromCredentialNames(
      impactedCredentials.map((credential) => credential.name),
    );
    const impactedJobIds = Array.from(new Set([...impactedJobIdsRaw, ...derivedJobIds]));

    const readinessBefore = new Map<string, ReadinessSnapshot>();
    for (const jobId of impactedJobIds) {
      const jobNumericId = Number(jobId);
      const job = Number.isFinite(jobNumericId)
        ? await prisma.job.findUnique({ where: { id: jobNumericId } })
        : null;
      const jobTitle = job?.title || jobId;
      readinessBefore.set(
        jobId,
        await buildReadinessSnapshot(clinician, clinicianKey, jobId, jobTitle),
      );
    }

    await prisma.pubMedPublication.upsert({
      where: { publicationId },
      update: {
        clinicianId: clinicianKey,
        title: title ? String(title) : undefined,
      },
      create: {
        publicationId,
        clinicianId: clinicianKey,
        title: title ? String(title) : undefined,
      },
    });

    const evidenceToInsert: { publicationId: string; clinicianId: string; jobId?: string; credentialId?: string }[] = [];
    const evidenceKeys = new Set<string>();
    for (const jobId of impactedJobIds) {
      evidenceKeys.add(`job:${jobId}`);
      evidenceToInsert.push({ publicationId, clinicianId: clinicianKey, jobId });
    }
    for (const credentialId of impactedCredentialIds) {
      const key = `cred:${credentialId}`;
      if (!evidenceKeys.has(key)) {
        evidenceKeys.add(key);
        evidenceToInsert.push({ publicationId, clinicianId: clinicianKey, credentialId });
      }
    }

    const existingEvidence = await prisma.pubMedEvidence.findMany({
      where: { publicationId, clinicianId: clinicianKey },
    });
    const existingKey = new Set(
      existingEvidence.map((item) => `${item.jobId || ''}:${item.credentialId || ''}`),
    );
    const toCreate = evidenceToInsert.filter(
      (item) => !existingKey.has(`${item.jobId || ''}:${item.credentialId || ''}`),
    );
    if (toCreate.length) {
      await prisma.pubMedEvidence.createMany({ data: toCreate });
    }

    try {
      const audit = await writeAuditEvent({
        eventType: 'PUBMED_EVIDENCE_APPLIED',
        subjectId: `pubmed:${publicationId}`,
        metadata: {
          publicationId,
          clinicianId: clinicianKey,
          impactedCredentialIds,
          impactedJobIds,
          evidenceCount: toCreate.length,
        },
      });

      for (const jobId of impactedJobIds) {
        const jobNumericId = Number(jobId);
        const job = Number.isFinite(jobNumericId)
          ? await prisma.job.findUnique({ where: { id: jobNumericId } })
          : null;
        const jobTitle = job?.title || jobId;
        const before = readinessBefore.get(jobId);
        if (!before) continue;
        const after = await buildReadinessSnapshot(clinician, clinicianKey, jobId, jobTitle);
        await emitEligibilityImpactEvents({
          clinicianKey,
          jobId,
          before,
          after,
          publicationId,
          affectedJobIds: impactedJobIds,
        });
      }

      return res.status(201).json({ publicationId, auditRef: audit.hash, evidenceCount: toCreate.length });
    } catch (error) {
      return res.status(503).json({
        error: 'Failed to append pubmed audit event',
        detail: String(error instanceof Error ? error.message : error),
      });
    }
  },
);

app.get('/employer/readiness/:clinicianId/:jobId', async (req, res) => {
  const clinicianId = String(req.params.clinicianId || '').trim();
  const jobId = String(req.params.jobId || '').trim();
  if (!clinicianId || !jobId) {
    return res.status(400).json({ error: 'clinicianId and jobId are required' });
  }

  const employerId = resolveEmployerId(req);
  const clinicianNumericId = Number(clinicianId);
  const clinician = Number.isFinite(clinicianNumericId)
    ? await prisma.user.findUnique({ where: { id: clinicianNumericId } })
    : await prisma.user.findUnique({ where: { email: clinicianId } });
  if (!clinician) {
    return res.status(404).json({ error: 'Clinician not found' });
  }
  const clinicianAuditId = String(clinician.id);

  const jobNumericId = Number(jobId);
  const job = Number.isFinite(jobNumericId)
    ? await prisma.job.findUnique({ where: { id: jobNumericId } })
    : null;
  const jobTitle = job?.title || jobId;
  const readiness = await buildReadinessSnapshot(clinician, clinicianAuditId, jobId, jobTitle);
  const response = {
    status: readiness.status,
    satisfiedCount: readiness.satisfiedCount,
    requiredCount: readiness.requiredCount,
    evidence: readiness.evidence,
    generatedAt: readiness.generatedAt,
  };

  try {
    await writeAuditEvent({
      eventType: 'EMPLOYER_READINESS_VIEWED',
      subjectId: `clinician:${clinicianAuditId}`,
      metadata: {
        employerId,
        clinicianId: clinicianAuditId,
        jobId,
        jobTitle,
        status: response.status,
        satisfiedCount: response.satisfiedCount,
        requiredCount: response.requiredCount,
        evidenceCount: response.evidence.length,
        generatedAt: response.generatedAt,
      },
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append readiness audit event',
      detail: String(error instanceof Error ? error.message : error),
    });
  }

  return res.json(response);
});

app.get('/employer/risk/:clinicianId/:jobId', async (req, res) => {
  const clinicianId = String(req.params.clinicianId || '').trim();
  const jobId = String(req.params.jobId || '').trim();
  if (!clinicianId || !jobId) {
    return res.status(400).json({ error: 'clinicianId and jobId are required' });
  }

  const employerId = resolveEmployerId(req);
  const clinicianNumericId = Number(clinicianId);
  const clinician = Number.isFinite(clinicianNumericId)
    ? await prisma.user.findUnique({ where: { id: clinicianNumericId } })
    : await prisma.user.findUnique({ where: { email: clinicianId } });
  if (!clinician) {
    return res.status(404).json({ error: 'Clinician not found' });
  }
  const clinicianAuditId = String(clinician.id);

  const jobNumericId = Number(jobId);
  const job = Number.isFinite(jobNumericId)
    ? await prisma.job.findUnique({ where: { id: jobNumericId } })
    : null;
  const jobTitle = job?.title || jobId;
  const requirements = resolveJobRequirements(jobId, jobTitle);

  const credentials = await prisma.credential.findMany({
    where: { userId: clinician.id },
    orderBy: { issuedAt: 'asc' },
  });

  const lifecycleRecords: CredentialLifecycle[] = credentials.map((credential) => {
    const expiresAt = credential.expiresAt ? credential.expiresAt.toISOString() : null;
    const renewalWindowDays = resolveRenewalWindowDays(credential.renewalWindowDays);
    const lifecycle = evaluateLifecycle(expiresAt, renewalWindowDays);
    return {
      externalId: `CRED-${credential.id}`,
      name: credential.name,
      daysRemaining: lifecycle.daysRemaining,
      currentState: lifecycle.currentState,
      revoked: false,
    };
  });

  const relevantCredentials = lifecycleRecords.filter((record) => {
    if (requirements.includes(ANY_CREDENTIAL_REQUIREMENT)) return true;
    return requirements.some(
      (requirement) => requirement.toLowerCase() === record.name.toLowerCase(),
    );
  });

  const reasons: string[] = [];
  let hasExpired = false;
  let hasRenewalWindow = false;
  for (const record of relevantCredentials) {
    if (record.currentState === 'EXPIRED') {
      hasExpired = true;
      reasons.push(`${record.name} expired`);
    } else if (record.currentState === 'RENEWAL_WINDOW') {
      hasRenewalWindow = true;
      if (record.daysRemaining !== null) {
        reasons.push(`${record.name} expires in ${record.daysRemaining} days`);
      } else {
        reasons.push(`${record.name} nearing renewal window`);
      }
    }
  }

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (hasExpired) {
    riskLevel = 'HIGH';
  } else if (hasRenewalWindow) {
    riskLevel = 'MEDIUM';
  }

  const generatedAt = new Date().toISOString();
  const response = {
    riskLevel,
    reasons,
    generatedAt,
  };

  try {
    await writeAuditEvent({
      eventType: 'EMPLOYER_RISK_VIEWED',
      subjectId: `clinician:${clinicianAuditId}`,
      metadata: {
        employerId,
        clinicianId: clinicianAuditId,
        jobId,
        jobTitle,
        riskLevel,
        reasonCount: reasons.length,
        generatedAt,
      },
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Failed to append risk audit event',
      detail: String(error instanceof Error ? error.message : error),
    });
  }

  return res.json(response);
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
