import { Request, Response } from 'express';
import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
} from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import oidc4vpRouter from '../oidc4vp/routes';
import { policyEnforcer } from '../policyEnforcer';
import { resetReplayTable } from '../security/dpopReplayTable';

const replayTableMock = vi.hoisted(() => {
  const seenJtis = new Set<string>();
  return {
    isReplayJti: vi.fn(async (jti: string) => {
      if (seenJtis.has(jti)) return true;
      seenJtis.add(jti);
      return false;
    }),
    resetReplayTable: vi.fn(() => {
      seenJtis.clear();
    }),
  };
});

vi.mock('../security/dpopReplayTable', () => replayTableMock);

type MockResponse = Response & {
  statusCode: number;
  body?: unknown;
};

function createMockResponse(): MockResponse {
  const res: Partial<MockResponse> = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this as MockResponse;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as MockResponse;
    },
  };

  return res as MockResponse;
}

async function signAccessToken(params: {
  audience: string;
  cnfJkt?: string;
  iat?: number;
}): Promise<string> {
  const { privateKey } = await generateKeyPair('ES256');
  const now = params.iat ?? Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: 'clinician:test',
    aud: params.audience,
    iat: now,
  };

  if (params.cnfJkt) {
    payload.cnf = { jkt: params.cnfJkt };
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

async function signDpopProof(params: {
  htu: string;
  htm: string;
  jti: string;
  iat?: number;
}): Promise<{ proof: string; jwk: JWK; thumbprint: string }> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const thumbprint = await calculateJwkThumbprint(jwk);
  const now = params.iat ?? Math.floor(Date.now() / 1000);

  const proof = await new SignJWT({
    htu: params.htu,
    htm: params.htm.toUpperCase(),
    jti: params.jti,
    iat: now,
  })
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'dpop+jwt',
      kid: 'test-kid',
      jwk,
    })
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);

  return { proof, jwk, thumbprint };
}

describe('verifier policy enforcer', () => {
  afterEach(() => {
    resetReplayTable();
  });

  it('rejects requests with missing DPoP proof', async () => {
    const token = await signAccessToken({ audience: 'https://api.vitalcv.ai' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      protocol: 'https',
      originalUrl: '/oidc4vp/presentation',
      get: (name: string) => (name.toLowerCase() === 'host' ? 'verifier.vitalcv.ai' : undefined),
    } as unknown as Request;

    const res = createMockResponse();
    const next = vi.fn();

    await policyEnforcer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'invalid_dpop',
      }),
    );
  });

  it('rejects access tokens with non-matching audience', async () => {
    const htu = 'https://verifier.vitalcv.ai/oidc4vp/presentation';
    const dpop = await signDpopProof({
      htu,
      htm: 'POST',
      jti: 'jti-aud-mismatch',
    });
    const token = await signAccessToken({
      audience: 'https://wrong.vitalcv.ai',
      cnfJkt: dpop.thumbprint,
    });

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
        dpop: dpop.proof,
      },
      method: 'POST',
      protocol: 'https',
      originalUrl: '/oidc4vp/presentation',
      get: (name: string) => (name.toLowerCase() === 'host' ? 'verifier.vitalcv.ai' : undefined),
    } as unknown as Request;

    const res = createMockResponse();
    const next = vi.fn();

    await policyEnforcer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'invalid_token',
      }),
    );
  });

  it('rejects replayed DPoP jti values', async () => {
    const htu = 'https://verifier.vitalcv.ai/oidc4vp/presentation';
    const dpop = await signDpopProof({
      htu,
      htm: 'POST',
      jti: 'replay-jti',
    });
    const token = await signAccessToken({
      audience: 'https://api.vitalcv.ai',
      cnfJkt: dpop.thumbprint,
    });

    const baseReq = {
      headers: {
        authorization: `Bearer ${token}`,
        dpop: dpop.proof,
      },
      method: 'POST',
      protocol: 'https',
      originalUrl: '/oidc4vp/presentation',
      get: (name: string) => (name.toLowerCase() === 'host' ? 'verifier.vitalcv.ai' : undefined),
    } as unknown as Request;

    const firstRes = createMockResponse();
    const firstNext = vi.fn();
    await policyEnforcer(baseReq, firstRes, firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const secondRes = createMockResponse();
    const secondNext = vi.fn();
    await policyEnforcer(baseReq, secondRes, secondNext);
    expect(secondNext).not.toHaveBeenCalled();
    expect(secondRes.statusCode).toBe(401);
    expect(secondRes.body).toEqual(
      expect.objectContaining({
        error: 'invalid_dpop',
      }),
    );
  });
});

describe('verifier metadata', () => {
  it('publishes strict OpenID metadata values', async () => {
    const layer = (oidc4vpRouter as unknown as { stack: Array<any> }).stack.find(
      (entry) => entry?.route?.path === '/.well-known/openid-configuration',
    );
    expect(layer).toBeDefined();

    const handler = layer.route.stack[0].handle as (req: Request, res: Response) => void;
    const req = {} as Request;
    const res = createMockResponse();

    handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.dpop_signing_alg_values_supported).toEqual(['ES256']);
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.require_pushed_authorization_requests).toBe(true);
    expect(body.clock_skew_seconds).toBe(60);
  });
});
