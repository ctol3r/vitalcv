import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

type WorldIdProof = {
  merkle_root?: string;
  nullifier_hash?: string;
  proof?: string;
};

type WorldIdTokenPayload = {
  app_id?: string;
  action?: string;
  signal?: string;
  credential_type?: string;
  proof?: WorldIdProof;
  merkle_root?: string;
  nullifier_hash?: string;
  proof_flat?: string;
  proof_raw?: string;
  verification_level?: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      worldIdVerified?: boolean;
      worldIdAuditRef?: string | null;
      worldIdNullifierHash?: string | null;
    };
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function privacyDigest(value: string): string {
  const pepper = process.env.WORLD_ID_PEPPER || process.env.WORLD_ID_NULLIFIER_PEPPER || '';
  return sha256Hex(`${pepper}:${value}`);
}

function parseTokenValue(raw: unknown): WorldIdTokenPayload | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return parseTokenValue(raw[0]);
  }
  if (typeof raw === 'object') return raw as WorldIdTokenPayload;
  if (typeof raw !== 'string') return null;

  const tryParse = (value: string): WorldIdTokenPayload | null => {
    try {
      return JSON.parse(value) as WorldIdTokenPayload;
    } catch {
      return null;
    }
  };

  return (
    tryParse(raw) ||
    tryParse(Buffer.from(raw, 'base64').toString('utf8')) ||
    null
  );
}

function extractWorldIdToken(req: Request): WorldIdTokenPayload | null {
  const headerToken =
    req.headers['x-world-id-token'] ||
    req.headers['world-id-token'] ||
    req.headers['worldid-token'];
  const bodyToken = req.body?.worldIdToken || req.body?.worldIdProof || req.body?.worldId;
  return parseTokenValue(bodyToken ?? headerToken ?? null);
}

function normalizeProof(payload: WorldIdTokenPayload | null): {
  app_id: string;
  action: string;
  signal?: string;
  credential_type: string;
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level?: string;
} | null {
  if (!payload) return null;
  const app_id = String(payload.app_id || process.env.WORLD_ID_APP_ID || '').trim();
  const action = String(payload.action || process.env.WORLD_ID_ACTION || '').trim();
  const credential_type = String(payload.credential_type || 'orb');
  const proof = payload.proof || {};

  const merkle_root = String(payload.merkle_root || proof.merkle_root || '').trim();
  const nullifier_hash = String(payload.nullifier_hash || proof.nullifier_hash || '').trim();
  const proofValue =
    String(payload.proof_flat || payload.proof_raw || proof.proof || '').trim();

  if (!app_id || !action || !merkle_root || !nullifier_hash || !proofValue) return null;

  return {
    app_id,
    action,
    signal: payload.signal ? String(payload.signal) : undefined,
    credential_type,
    merkle_root,
    nullifier_hash,
    proof: proofValue,
    verification_level: payload.verification_level
      ? String(payload.verification_level)
      : undefined,
  };
}

async function writeWorldIdAuditEvent(params: {
  type: string;
  nullifier_hash?: string;
  action?: string;
  credential_type?: string;
  signal?: string;
  verification_level?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const hash = sha256Hex(
    `${params.type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  );

  const baseMetadata: Record<string, unknown> = {
    action: params.action ?? null,
    credential_type: params.credential_type ?? null,
    verification_level: params.verification_level ?? null,
    nullifierDigest: params.nullifier_hash ? privacyDigest(params.nullifier_hash) : null,
    signalDigest: params.signal ? privacyDigest(params.signal) : null,
  };

  const metadata = { ...baseMetadata, ...(params.metadata ?? {}) };
  await prisma.auditEvent.create({
    data: {
      type: params.type,
      hash,
      metadata,
    },
  });
  return hash;
}

export async function worldIdVerificationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tokenPayload = extractWorldIdToken(req);
  const normalized = normalizeProof(tokenPayload);
  if (!normalized) {
    res.status(403).json({ error: 'Proof-of-personhood required' });
    return;
  }

  const apiKey = String(
    process.env.WORLD_ID_API_KEY || process.env.WORLD_ID_VERIFY_KEY || '',
  ).trim();
  if (!apiKey) {
    res.status(501).json({
      error: 'World ID verification key is not configured on this deployment',
    });
    return;
  }

  const verifyUrl =
    String(process.env.WORLD_ID_VERIFY_URL || '').trim() ||
    'https://developer.worldcoin.org/api/v1/verify';

  const startedAt = Date.now();
  let verified = false;
  let upstream: unknown = null;

  try {
    const verifyResp = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: normalized.app_id,
        action: normalized.action,
        signal: normalized.signal ?? '',
        credential_type: normalized.credential_type,
        proof: {
          merkle_root: normalized.merkle_root,
          nullifier_hash: normalized.nullifier_hash,
          proof: normalized.proof,
        },
      }),
    });

    const rawText = await verifyResp.text();
    upstream = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return { raw: rawText };
      }
    })();

    verified =
      verifyResp.ok &&
      Boolean((upstream as { success?: boolean; verified?: boolean })?.success ||
        (upstream as { verified?: boolean })?.verified);
  } catch (e) {
    upstream = { error: String(e instanceof Error ? e.message : e) };
    verified = false;
  }

  const auditType = verified
    ? 'WORLD_ID_ISSUANCE_VERIFIED'
    : 'WORLD_ID_ISSUANCE_REJECTED';
  const auditRef = await writeWorldIdAuditEvent({
    type: auditType,
    nullifier_hash: normalized.nullifier_hash,
    action: normalized.action,
    credential_type: normalized.credential_type,
    signal: normalized.signal,
    verification_level: normalized.verification_level,
    metadata: {
      httpStatus: verified ? 200 : 403,
      latencyMs: Date.now() - startedAt,
    },
  }).catch((e) => {
    log('warn', 'world_id_audit_write_failed', {
      error: String(e instanceof Error ? e.message : e),
    });
    return null;
  });

  if (!verified) {
    res.status(403).json({
      error: 'Proof-of-personhood required',
      upstream,
      auditRef,
    });
    return;
  }

  req.user = {
    ...(req.user ?? {}),
    worldIdVerified: true,
    worldIdAuditRef: auditRef,
    worldIdNullifierHash: normalized.nullifier_hash,
  };

  next();
}
