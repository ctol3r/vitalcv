import type { NextFunction, Request, Response } from 'express';
// `CryptoKey` comes from the global WebCrypto types, not from jose: v6 exports
// the type and v5 does not, so importing it would pin this file to one major.
// See the runtime contract test for why the backend must stay on a jose that
// ships a CommonJS build.
import { SignJWT, generateKeyPair, jwtVerify } from 'jose';
import {
  ACCEPTED_JWT_ALGORITHMS,
  createTokenVerifier,
  createVerifiedIdentityMiddleware,
  type TokenVerifier,
  type VerifiedAuth,
} from '../verifiedIdentity';

// G1 header-trust closure (ASVS 14.5.4 / gap register G1,
// docs/security/ASVS-scorecard-2026-07.md): identity must come from a verified
// Clerk session JWT, not from forgeable x-clerk-user-id headers. These tests
// run the REAL jose verification path against a local ES256 keypair — issuer,
// exp, and signature checks are exercised, not stubbed.

const ISSUER = 'https://clerk.test.vitalcv.com';

const mockEnv = {
  CLERK_JWT_VERIFICATION: 'off' as 'off' | 'shadow' | 'enforce',
  CLERK_ISSUER: ISSUER,
  CLERK_AUTHORIZED_PARTIES: [] as string[],
};

jest.mock('../../config/env', () => ({
  env: () => mockEnv,
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

let privateKey: CryptoKey;
let publicKey: CryptoKey;
let verifier: TokenVerifier;

beforeAll(async () => {
  ({ privateKey, publicKey } = await generateKeyPair('ES256'));
  verifier = async (token: string) => {
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER });
    return payload;
  };
});

async function mint(
  claims: Record<string, unknown>,
  opts: { issuer?: string; expired?: boolean } = {},
): Promise<string> {
  // jose@4 rejects negative relative periods — use an absolute past epoch.
  const exp = opts.expired ? Math.floor(Date.now() / 1000) - 300 : '5m';
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey);
}

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: { ...headers },
    path: '/api/test',
    method: 'GET',
  } as unknown as Request;
}

function createResponse(): { res: Response; statusCode: () => number | null; body: () => unknown } {
  let status: number | null = null;
  let payload: unknown = null;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  return { res, statusCode: () => status, body: () => payload };
}

async function run(
  headers: Record<string, string>,
): Promise<{ req: Request; next: jest.Mock; statusCode: () => number | null; auth: () => VerifiedAuth | undefined }> {
  const middleware = createVerifiedIdentityMiddleware({ verifier });
  const req = createRequest(headers);
  const { res, statusCode } = createResponse();
  const next = jest.fn() as unknown as jest.Mock;
  await middleware(req, res, next as unknown as NextFunction);
  return { req, next, statusCode, auth: () => (req as any).verifiedAuth };
}

describe('verifiedIdentity — off mode', () => {
  it('is a pure pass-through', async () => {
    mockEnv.CLERK_JWT_VERIFICATION = 'off';
    const { next, auth } = await run({ 'x-clerk-user-id': 'user_forged' });
    expect(next).toHaveBeenCalled();
    expect(auth()).toBeUndefined();
  });
});

describe('verifiedIdentity — shadow mode (never blocks)', () => {
  beforeEach(() => {
    mockEnv.CLERK_JWT_VERIFICATION = 'shadow';
    mockEnv.CLERK_AUTHORIZED_PARTIES = [];
  });

  it('classifies anonymous requests', async () => {
    const { next, auth } = await run({});
    expect(next).toHaveBeenCalled();
    expect(auth()?.outcome).toBe('anonymous');
  });

  it('classifies legacy header-without-token call sites', async () => {
    const { next, auth } = await run({ 'x-clerk-user-id': 'user_1' });
    expect(next).toHaveBeenCalled();
    expect(auth()?.outcome).toBe('header_without_token');
  });

  it('verifies a matching token + header', async () => {
    const token = await mint({ sub: 'user_1' });
    const { next, auth } = await run({ 'x-clerk-user-id': 'user_1', authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalled();
    expect(auth()).toMatchObject({ outcome: 'verified_match', verifiedUserId: 'user_1' });
  });

  it('flags a forged header that mismatches the verified sub — but still never blocks', async () => {
    const token = await mint({ sub: 'user_real' });
    const { next, auth, statusCode } = await run({
      'x-clerk-user-id': 'user_forged',
      authorization: `Bearer ${token}`,
    });
    expect(next).toHaveBeenCalled();
    expect(statusCode()).toBeNull();
    expect(auth()).toMatchObject({ outcome: 'verified_mismatch', verifiedUserId: 'user_real' });
  });

  it('classifies an expired token as invalid and does not block', async () => {
    const token = await mint({ sub: 'user_1' }, { expired: true });
    const { next, auth } = await run({ 'x-clerk-user-id': 'user_1', authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalled();
    expect(auth()?.outcome).toBe('invalid_token');
  });

  it('rejects a wrong-issuer token as invalid', async () => {
    const token = await mint({ sub: 'user_1' }, { issuer: 'https://evil.example.com' });
    const { auth } = await run({ 'x-clerk-user-id': 'user_1', authorization: `Bearer ${token}` });
    expect(auth()?.outcome).toBe('invalid_token');
  });

  it('rejects a token without a sub claim', async () => {
    const token = await mint({});
    const { auth } = await run({ authorization: `Bearer ${token}` });
    expect(auth()?.outcome).toBe('invalid_token');
    expect(auth()?.reason).toBe('missing_sub');
  });

  it('does not rewrite headers in shadow mode', async () => {
    const token = await mint({ sub: 'user_real' });
    const { req } = await run({ 'x-clerk-user-id': 'user_forged', authorization: `Bearer ${token}` });
    expect(req.headers['x-clerk-user-id']).toBe('user_forged');
  });
});

describe('verifiedIdentity — enforce mode', () => {
  beforeEach(() => {
    mockEnv.CLERK_JWT_VERIFICATION = 'enforce';
    mockEnv.CLERK_AUTHORIZED_PARTIES = [];
  });

  it('rewrites x-clerk-user-id to the verified sub (downstream readers get proven identity)', async () => {
    const token = await mint({ sub: 'user_real' });
    const { req, next } = await run({ 'x-clerk-user-id': 'user_real', authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-clerk-user-id']).toBe('user_real');
  });

  it('neutralizes a forged header by overwriting it with the verified sub', async () => {
    const token = await mint({ sub: 'user_real' });
    const { req, next } = await run({ 'x-clerk-user-id': 'user_forged', authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-clerk-user-id']).toBe('user_real');
  });

  it('401s an identity header presented without any token — fail closed', async () => {
    const { next, statusCode } = await run({ 'x-clerk-user-id': 'user_1' });
    expect(statusCode()).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s an identity header presented with an invalid token — fail closed', async () => {
    const token = await mint({ sub: 'user_1' }, { expired: true });
    const { next, statusCode } = await run({ 'x-clerk-user-id': 'user_1', authorization: `Bearer ${token}` });
    expect(statusCode()).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets anonymous requests through but strips role-bypass headers (super-admin bypass closed)', async () => {
    const { req, next, statusCode } = await run({
      'x-user-role': 'super-admin',
      'x-verifier-role': 'admin',
      'x-role': 'super-admin',
    });
    expect(next).toHaveBeenCalled();
    expect(statusCode()).toBeNull();
    expect(req.headers['x-user-role']).toBeUndefined();
    expect(req.headers['x-verifier-role']).toBeUndefined();
    expect(req.headers['x-role']).toBeUndefined();
  });

  it('preserves role headers when the request carries a verified token', async () => {
    const token = await mint({ sub: 'user_real' });
    const { req, next } = await run({
      'x-clerk-user-id': 'user_real',
      'x-user-role': 'verifier-admin',
      authorization: `Bearer ${token}`,
    });
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-user-role']).toBe('verifier-admin');
  });
});

/**
 * S1 — algorithm allowlist.
 *
 * `jwtVerify` with no `algorithms` option accepts whatever the token's own
 * header names, which makes the attacker a participant in choosing how their
 * token is checked (the `alg: none` / RS256→HS256-confusion family).
 *
 * These run `createTokenVerifier` — the SAME factory `getRemoteVerifier` uses
 * in production, differing only in the key input — so the assertion is about
 * the shipped verification path, not a stub. Asserted as an outcome: a token
 * the issuer never could have signed does not verify.
 */
describe('verifiedIdentity — JWT algorithm allowlist', () => {
  beforeEach(() => {
    mockEnv.CLERK_JWT_VERIFICATION = 'shadow';
    mockEnv.CLERK_AUTHORIZED_PARTIES = [];
  });

  it('accepts only RS256 — Clerk signs session tokens with nothing else', () => {
    expect([...ACCEPTED_JWT_ALGORITHMS]).toEqual(['RS256']);
  });

  it('verifies a well-formed RS256 token', async () => {
    const rsa = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'user_rs' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(rsa.privateKey);

    const payload = await createTokenVerifier(rsa.publicKey, ISSUER)(token);
    expect(payload.sub).toBe('user_rs');
  });

  it('refuses an otherwise-valid token signed with a non-allowlisted algorithm', async () => {
    // Correct issuer, unexpired, valid signature over its own key. The ONLY
    // thing wrong with it is the algorithm.
    const es = await generateKeyPair('ES256');
    const token = await new SignJWT({ sub: 'user_es' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(es.privateKey);

    await expect(createTokenVerifier(es.publicKey, ISSUER)(token)).rejects.toThrow();
  });

  it('classifies a non-allowlisted-algorithm token as invalid through the middleware', async () => {
    const es = await generateKeyPair('ES256');
    const token = await new SignJWT({ sub: 'user_es' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(es.privateKey);

    const middleware = createVerifiedIdentityMiddleware({
      verifier: createTokenVerifier(es.publicKey, ISSUER),
    });
    const req = createRequest({ 'x-clerk-user-id': 'user_es', authorization: `Bearer ${token}` });
    const { res } = createResponse();
    await middleware(req, res, (() => undefined) as unknown as NextFunction);

    expect((req as any).verifiedAuth?.outcome).toBe('invalid_token');
    expect((req as any).verifiedAuth?.verifiedUserId).toBeUndefined();
  });
});

describe('verifiedIdentity — azp allowlist', () => {
  beforeEach(() => {
    mockEnv.CLERK_JWT_VERIFICATION = 'shadow';
  });

  it('rejects a token whose azp is not in the allowlist', async () => {
    mockEnv.CLERK_AUTHORIZED_PARTIES = ['https://vitalcv.com'];
    const token = await mint({ sub: 'user_1', azp: 'https://evil.example.com' });
    const { auth } = await run({ authorization: `Bearer ${token}` });
    expect(auth()?.outcome).toBe('invalid_token');
    expect(auth()?.reason).toContain('azp_not_allowed');
  });

  it('accepts a token whose azp is allowlisted', async () => {
    mockEnv.CLERK_AUTHORIZED_PARTIES = ['https://vitalcv.com'];
    const token = await mint({ sub: 'user_1', azp: 'https://vitalcv.com' });
    const { auth } = await run({ authorization: `Bearer ${token}` });
    expect(auth()).toMatchObject({ outcome: 'token_only', verifiedUserId: 'user_1' });
  });

  it('skips the azp check when the allowlist is empty', async () => {
    mockEnv.CLERK_AUTHORIZED_PARTIES = [];
    const token = await mint({ sub: 'user_1', azp: 'https://anything.example.com' });
    const { auth } = await run({ authorization: `Bearer ${token}` });
    expect(auth()?.outcome).toBe('token_only');
  });
});
