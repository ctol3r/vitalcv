export class RateLimitError extends Error {
  readonly scope: 'issuer' | 'verifier';
  readonly limit: number;
  readonly windowMs: number;

  constructor(scope: 'issuer' | 'verifier', limit: number, windowMs: number) {
    super(`${scope}_rate_limited`);
    this.scope = scope;
    this.limit = limit;
    this.windowMs = windowMs;
  }
}

const WINDOW_MS = Number(process.env.VERIFICATION_RATE_WINDOW_MS ?? 60_000);
const ISSUER_LIMIT = Number(process.env.VERIFICATION_RATE_PER_ISSUER ?? 30);
const VERIFIER_LIMIT = Number(process.env.VERIFICATION_RATE_PER_VERIFIER ?? 60);

const issuerBuckets = new Map<string, number[]>();
const verifierBuckets = new Map<string, number[]>();

export interface RateLimitContext {
  issuerDid?: string | null;
  verifierId?: string | null;
}

export function enforceVerificationRateLimit(context: RateLimitContext): void {
  const now = Date.now();

  if (context.issuerDid) {
    const ok = consumeBucket(issuerBuckets, context.issuerDid, ISSUER_LIMIT, now);
    if (!ok) {
      throw new RateLimitError('issuer', ISSUER_LIMIT, WINDOW_MS);
    }
  }

  const verifierKey = context.verifierId ?? 'anonymous';
  const ok = consumeBucket(verifierBuckets, verifierKey, VERIFIER_LIMIT, now);
  if (!ok) {
    throw new RateLimitError('verifier', VERIFIER_LIMIT, WINDOW_MS);
  }
}

function consumeBucket(
  store: Map<string, number[]>,
  key: string,
  limit: number,
  now: number,
): boolean {
  const window = store.get(key) ?? [];
  while (window.length && now - window[0] > WINDOW_MS) {
    window.shift();
  }
  if (window.length >= limit) {
    store.set(key, window);
    return false;
  }
  window.push(now);
  store.set(key, window);
  return true;
}



