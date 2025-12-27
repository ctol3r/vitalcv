import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
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
import { errorHandler } from './middleware/errorHandler';
import { validateRequest } from './middleware/validateRequest';
import { log, reqLogFields } from './obs/logger';
import { requestIdMiddleware, type RequestWithId } from './obs/requestId';
import matchingRouter from './routes/matching';

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
  const secret = process.env.JWT_SECRET || 'dev-only-secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
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

async function writeAuditEvent(event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: any;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: event.type,
      credentialId: event.credentialId || null,
      userId: event.userId || null,
      createdAt: createdAt.toISOString(),
      metadata: event.metadata || null,
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
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
  const dbOk = await withTimeout(
    prisma.$queryRaw`SELECT 1`,
    Number(process.env.HEALTH_DB_TIMEOUT_MS || 800),
    'db',
  )
    .then(() => true)
    .catch(() => false);

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    gitSha,
  });
});

app.get('/healthz', async (_req, res) => {
  const startedAt = Date.now();

  const dbPromise = withTimeout(
    prisma.$queryRaw`SELECT 1`,
    Number(process.env.HEALTH_DB_TIMEOUT_MS || 1200),
    'db',
  )
    .then(() => ({ ok: true as const }))
    .catch((e) => ({ ok: false as const, error: String(e instanceof Error ? e.message : e) }));

  // Substrate is optional for ON. If configured we show it, but we don't block readiness on chain connectivity.
  const chainPromise = Promise.resolve().then(() => {
    const ws = String(process.env.SUBSTRATE_WS || '').trim();
    if (!ws) {
      return { ok: true as const, configured: false as const, status: 'not_configured' as const };
    }
    return { ok: true as const, configured: true as const, status: 'skipped' as const };
  });

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

  const [db, chain, acapy, graph, agent] = await Promise.all([
    dbPromise,
    chainPromise,
    acapyPromise,
    graphPromise,
    agentPromise,
  ]);
  const ok = db.ok && chain.ok && acapy.ok;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    checks: {
      db,
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
  const db = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  // For readiness, require DB only; other dependencies are reported in /health but shouldn't block boot.
  const ok = db;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    services: {
      database: db,
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
        type: 'WORLD_ID_VERIFY_ATTEMPT',
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
      type: verified ? 'WORLD_ID_VERIFIED' : 'WORLD_ID_VERIFY_FAILED',
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

  res.json({
    lastEvent: latest
      ? {
          type: latest.type,
          timestamp: latest.createdAt?.toISOString?.() ?? null,
        }
      : null,
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
    await prisma.auditEvent.deleteMany();
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
    type: 'DEMO_SEED',
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
      type: 'AUTH_SIGNUP',
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
    await writeAuditEvent({ type: 'AUTH_LOGIN', userId: user.id, metadata: { email: user.email } });
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
        type: 'WORLD_ID_VERIFY_FAILURE',
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
      type: 'WORLD_ID_VERIFY_SUCCESS',
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
      type: 'WORLD_ID_VERIFY_ERROR',
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
app.post(
  '/issuer/credential',
  body('subjectId').isString().withMessage('subjectId is required'),
  body('type').isString().withMessage('type is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const { subjectId, type, issuingAuthority, expiryDate, licenseNumber, additionalData } =
      req.body as Record<string, any>;

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
    const credential = await prisma.credential.create({
      data: {
        name: String(type),
        issuer,
        userId: user.id,
      },
    });

    const externalId = `CRED-${credential.id}`;
    const jwtPayload = {
      credentialId: externalId,
      subjectId,
      type,
      issuer,
      issuedAt: credential.issuedAt.toISOString(),
      expiryDate: expiryDate || null,
      licenseNumber: licenseNumber || null,
      additionalData: additionalData || null,
    };
    const jwtToken = signDemoJwt(jwtPayload);

    const audit = await writeAuditEvent({
      type: 'ISSUE_CREDENTIAL',
      credentialId: externalId,
      userId: user.id,
      metadata: jwtPayload,
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
  await writeAuditEvent({ type: 'GRAPH_DEMO_SEED', metadata: { ok: true } });
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

    const audit = await writeAuditEvent({
      type: 'REVOKE_CREDENTIAL',
      credentialId: externalId,
      metadata: { reason: reason || null },
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
    const { credentialId, nonce, audience, privacyMode, disclosureType } = req.body as Record<
      string,
      any
    >;
    const { externalId, dbId } = normalizeCredentialId(credentialId);
    if (!externalId) return res.status(400).json({ error: 'credentialId is required' });

    const credential = dbId ? await prisma.credential.findUnique({ where: { id: dbId } }) : null;
    if (!credential) {
      const audit = await writeAuditEvent({
        type: 'VERIFY_PRESENTATION',
        credentialId: externalId,
        metadata: {
          nonce,
          audience,
          privacyMode: !!privacyMode,
          disclosureType,
          status: 'unknown',
        },
      });
      return res
        .status(200)
        .json({ valid: false, status: 'unknown', auditRef: audit.hash, reason: 'Not found' });
    }

    const lastRevoke = await prisma.auditEvent.findFirst({
      where: { type: 'REVOKE_CREDENTIAL', credentialId: externalId },
      orderBy: { createdAt: 'desc' },
    });
    const revoked = Boolean(lastRevoke);

    const status = revoked ? 'revoked' : 'valid';
    const audit = await writeAuditEvent({
      type: 'VERIFY_PRESENTATION',
      credentialId: externalId,
      metadata: {
        nonce,
        audience,
        privacyMode: !!privacyMode,
        disclosureType,
        status,
      },
    });

    return res.status(200).json({
      valid: !revoked,
      status,
      auditRef: audit.hash,
      issuer: credential.issuer,
      issuedDate: credential.issuedAt.toISOString(),
      reason: revoked ? 'Credential revoked' : undefined,
    });
  },
);

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

app.use('/api', matchingRouter);

app.use(errorHandler);

export default app;
