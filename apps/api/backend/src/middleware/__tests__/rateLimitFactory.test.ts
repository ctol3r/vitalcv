/**
 * G3 (Wave 1509 · S3) — bucket keying and 429 shape.
 *
 * The keying rules are the security-relevant part: keying on a caller-supplied
 * identity header while `CLERK_JWT_VERIFICATION` is not `enforce` would let an
 * attacker mint an unlimited number of buckets by rotating a header, which is
 * strictly worse than no limiter at all.
 */
import type { NextFunction, Request, Response } from 'express';

const mockEnv = jest.fn(() => ({ CLERK_JWT_VERIFICATION: 'off' as string }));
jest.mock('../../config/env', () => ({ env: () => mockEnv() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createTierRateLimiter } = require('../rateLimitFactory') as typeof import('../rateLimitFactory');

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  locals: Record<string, unknown>;
};

function createRequest(
  headers: Record<string, string> = {},
  ip = '203.0.113.7',
): Request {
  return { headers, ip, socket: { remoteAddress: ip } } as unknown as Request;
}

function createResponse(locals: Record<string, unknown> = {}): MockResponse {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    locals,
  };
  res.status.mockReturnValue(res);
  return res as unknown as MockResponse;
}

function headerOf(res: MockResponse, name: string): string | undefined {
  const call = [...res.setHeader.mock.calls].reverse().find(([key]) => key === name);
  return call?.[1];
}

/** Drive a limiter n times with the same req/res factory; return the last response. */
function drive(
  limiter: (req: Request, res: Response, next: NextFunction) => void,
  times: number,
  makeReq: () => Request,
  makeRes: () => MockResponse = () => createResponse(),
): MockResponse {
  let res = makeRes();
  for (let i = 0; i < times; i += 1) {
    res = makeRes();
    limiter(makeReq(), res, jest.fn());
  }
  return res;
}

describe('rateLimitFactory — G3 keying', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.mockReturnValue({ CLERK_JWT_VERIFICATION: 'off' });
  });

  it('keys by IP when JWT verification is off, and reports scope=ip', () => {
    const limiter = createTierRateLimiter('proof');
    const res = createResponse();
    limiter(createRequest(), res, jest.fn());
    expect(headerOf(res, 'x-rate-limit-scope')).toBe('ip');
  });

  it('IGNORES x-clerk-user-id unless verification is enforced', () => {
    // Two requests from one IP carrying different user headers must share a
    // bucket — otherwise header rotation defeats the limiter entirely.
    const limiter = createTierRateLimiter('wallet');
    let n = 0;
    const res = drive(limiter, 51, () => {
      n += 1;
      return createRequest({ 'x-clerk-user-id': `spoofed_${n}` }, '198.51.100.9');
    });
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headerOf(res, 'x-rate-limit-scope')).toBe('ip');
  });

  it('keys by verified user id under enforce, and separates users on one IP', () => {
    mockEnv.mockReturnValue({ CLERK_JWT_VERIFICATION: 'enforce' });
    const limiter = createTierRateLimiter('wallet');

    // Exhaust user A from a shared IP.
    const exhausted = drive(limiter, 51, () =>
      createRequest({ 'x-clerk-user-id': 'user_a' }, '198.51.100.10'),
    );
    expect(exhausted.status).toHaveBeenCalledWith(429);
    expect(headerOf(exhausted, 'x-rate-limit-scope')).toBe('user');

    // User B behind the same IP (shared NAT/hospital egress) is unaffected.
    const other = createResponse();
    limiter(createRequest({ 'x-clerk-user-id': 'user_b' }, '198.51.100.10'), other, jest.fn());
    expect(other.status).not.toHaveBeenCalledWith(429);
  });

  it('prefers an API key over IP', () => {
    const limiter = createTierRateLimiter('credentialStatus');
    const res = createResponse({ api_key_id: 'key_123' });
    limiter(createRequest(), res, jest.fn());
    expect(headerOf(res, 'x-rate-limit-scope')).toBe('api_key');
  });
});

describe('rateLimitFactory — honest 429', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.mockReturnValue({ CLERK_JWT_VERIFICATION: 'off' });
  });

  it('sends Retry-After plus the limit, window, and scope that were applied', () => {
    const limiter = createTierRateLimiter('passportExport');
    const res = drive(limiter, 11, () => createRequest({}, '192.0.2.55'));

    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls.at(-1)?.[0];
    expect(body).toMatchObject({
      error: 'rate_limit_exceeded',
      tier: 'passport-export',
      limit: 10,
      windowMs: 60_000,
      scope: 'ip',
    });
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);

    // A 429 without Retry-After makes well-behaved clients hammer.
    const retryAfter = headerOf(res, 'Retry-After');
    expect(Number(retryAfter)).toBe(body.retryAfterSeconds);
  });

  it('allows the configured number of requests before refusing', () => {
    const limiter = createTierRateLimiter('passportExport');
    const req = (): Request => createRequest({}, '192.0.2.77');

    const tenth = drive(limiter, 10, req);
    expect(tenth.status).not.toHaveBeenCalledWith(429);
    expect(headerOf(tenth, 'x-rate-limit-remaining')).toBe('0');

    const eleventh = createResponse();
    limiter(req(), eleventh, jest.fn());
    expect(eleventh.status).toHaveBeenCalledWith(429);
  });

  it('isolates buckets per tier so one lane cannot exhaust another', () => {
    const exportLimiter = createTierRateLimiter('passportExport');
    const readLimiter = createTierRateLimiter('trustState');
    const req = (): Request => createRequest({}, '192.0.2.88');

    const exhausted = drive(exportLimiter, 11, req);
    expect(exhausted.status).toHaveBeenCalledWith(429);

    const read = createResponse();
    readLimiter(req(), read, jest.fn());
    expect(read.status).not.toHaveBeenCalledWith(429);
  });
});
