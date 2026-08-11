import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for @vitalcv/haip-config.
 *
 * Because the config is built at module-load time from process.env,
 * we use vi.resetModules() + dynamic import() to get a fresh module
 * for each test that needs different env values.
 */
describe('@vitalcv/haip-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadFresh() {
    return await import('../index');
  }

  // ── Algorithm whitelist ───────────────────────────────────

  describe('algorithm whitelist', () => {
    it('includes only ES256', async () => {
      const { haipConfig } = await loadFresh();
      expect(haipConfig.allowedAlgorithms).toEqual(['ES256']);
    });

    it('is frozen (immutable)', async () => {
      const { haipConfig } = await loadFresh();
      expect(Object.isFrozen(haipConfig.allowedAlgorithms)).toBe(true);
    });
  });

  // ── assertAlgorithmAllowed ────────────────────────────────

  describe('assertAlgorithmAllowed', () => {
    it('allows ES256', async () => {
      const { assertAlgorithmAllowed } = await loadFresh();
      expect(() => assertAlgorithmAllowed('ES256')).not.toThrow();
    });

    it('rejects RS256', async () => {
      const { assertAlgorithmAllowed, HaipViolationError } = await loadFresh();
      expect(() => assertAlgorithmAllowed('RS256')).toThrow(HaipViolationError);
    });

    it('rejects PS256', async () => {
      const { assertAlgorithmAllowed, HaipViolationError } = await loadFresh();
      expect(() => assertAlgorithmAllowed('PS256')).toThrow(HaipViolationError);
    });

    it('rejects EdDSA (HAIP 1.0 mandates ES256 only)', async () => {
      const { assertAlgorithmAllowed, HaipViolationError } = await loadFresh();
      expect(() => assertAlgorithmAllowed('EdDSA')).toThrow(HaipViolationError);
    });

    it('includes violation code INVALID_ALGORITHM', async () => {
      // `assertAlgorithmAllowed` is an assertion function
      // (`asserts alg is HaipAlgorithm`), and TypeScript refuses to call one
      // through an inferred binding (TS2775) — the annotation has to sit on the
      // identifier's own declaration, which a destructuring pattern does not
      // satisfy. Only this call site needs it: the others invoke it inside an
      // arrow passed to `expect`, where the narrowing never applies.
      const assertAlgorithmAllowed: typeof import('../index').assertAlgorithmAllowed = (
        await loadFresh()
      ).assertAlgorithmAllowed;
      try {
        assertAlgorithmAllowed('none');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as { code: string }).code).toBe('INVALID_ALGORITHM');
      }
    });
  });

  // ── PKCE enforcement ──────────────────────────────────────

  describe('PKCE enforcement', () => {
    it('requires PKCE by default (HAIP_ENFORCE=true)', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.pkce.required).toBe(true);
    });

    it('allows only S256', async () => {
      const { haipConfig } = await loadFresh();
      expect(haipConfig.pkce.allowedMethods).toEqual(['S256']);
    });

    it('assertPkceValid throws when no code_challenge provided', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertPkceValid, HaipViolationError } = await loadFresh();
      expect(() =>
        assertPkceValid({ codeChallenge: null, codeChallengeMethod: null }),
      ).toThrow(HaipViolationError);
    });

    it('assertPkceValid throws for plain method', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertPkceValid, HaipViolationError } = await loadFresh();
      expect(() =>
        assertPkceValid({ codeChallenge: 'abc123', codeChallengeMethod: 'plain' }),
      ).toThrow(HaipViolationError);
    });

    it('assertPkceValid passes for S256', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertPkceValid } = await loadFresh();
      expect(() =>
        assertPkceValid({ codeChallenge: 'abc123hash', codeChallengeMethod: 'S256' }),
      ).not.toThrow();
    });
  });

  // ── PAR enforcement ───────────────────────────────────────

  describe('PAR enforcement', () => {
    it('requires PAR globally when HAIP enforced', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.par.required).toBe(true);
    });

    it('assertParRequired throws when no request_uri', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertParRequired, HaipViolationError } = await loadFresh();
      expect(() =>
        assertParRequired({ requestUri: null, scope: 'openid' }),
      ).toThrow(HaipViolationError);
    });

    it('assertParRequired throws for high-risk scopes even without global enforce', async () => {
      process.env.HAIP_ENFORCE = 'false';
      process.env.PAR_REQUIRED = 'false';
      const { assertParRequired, HaipViolationError } = await loadFresh();
      expect(() =>
        assertParRequired({
          requestUri: null,
          scope: 'openid credential:issue:license',
        }),
      ).toThrow(HaipViolationError);
    });

    it('assertParRequired passes when request_uri provided', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertParRequired } = await loadFresh();
      expect(() =>
        assertParRequired({ requestUri: 'urn:ietf:params:oauth:request_uri:abc123', scope: 'openid' }),
      ).not.toThrow();
    });
  });

  // ── DPoP enforcement ──────────────────────────────────────

  describe('DPoP enforcement', () => {
    it('requires DPoP by default', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.dpop.required).toBe(true);
    });

    it('assertDpopRequired throws for wallet without DPoP header', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertDpopRequired, HaipViolationError } = await loadFresh();
      expect(() =>
        assertDpopRequired({ dpopHeader: null, clientType: 'wallet' }),
      ).toThrow(HaipViolationError);
    });

    it('assertDpopRequired passes with DPoP header', async () => {
      process.env.HAIP_ENFORCE = 'true';
      const { assertDpopRequired } = await loadFresh();
      expect(() =>
        assertDpopRequired({ dpopHeader: 'eyJ...', clientType: 'wallet' }),
      ).not.toThrow();
    });

    it('has maxProofLifetimeSeconds defaulting to 300', async () => {
      const { haipConfig } = await loadFresh();
      expect(haipConfig.dpop.maxProofLifetimeSeconds).toBe(300);
    });

    it('respects DPOP_MAX_PROOF_LIFETIME_SECONDS env var', async () => {
      process.env.HAIP_ENFORCE = 'false';
      process.env.DPOP_MAX_PROOF_LIFETIME_SECONDS = '120';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.dpop.maxProofLifetimeSeconds).toBe(120);
    });

    it('assertDpopExpValid rejects exp exceeding max lifetime', async () => {
      const { assertDpopExpValid, HaipViolationError } = await loadFresh();
      const now = Math.floor(Date.now() / 1000);
      expect(() =>
        assertDpopExpValid({ iat: now, exp: now + 600 }),
      ).toThrow(HaipViolationError);
    });

    it('assertDpopExpValid accepts exp within max lifetime', async () => {
      const { assertDpopExpValid } = await loadFresh();
      const now = Math.floor(Date.now() / 1000);
      expect(() =>
        assertDpopExpValid({ iat: now, exp: now + 300 }),
      ).not.toThrow();
    });

    it('assertDpopExpValid is a no-op when exp or iat is null', async () => {
      const { assertDpopExpValid } = await loadFresh();
      expect(() => assertDpopExpValid({ iat: null, exp: null })).not.toThrow();
      expect(() => assertDpopExpValid({ iat: 100, exp: null })).not.toThrow();
      expect(() => assertDpopExpValid({ iat: null, exp: 200 })).not.toThrow();
    });
  });

  // ── Config immutability ───────────────────────────────────

  describe('config immutability', () => {
    it('root config is frozen', async () => {
      const { haipConfig } = await loadFresh();
      expect(Object.isFrozen(haipConfig)).toBe(true);
    });

    it('dpop config is frozen', async () => {
      const { haipConfig } = await loadFresh();
      expect(Object.isFrozen(haipConfig.dpop)).toBe(true);
    });

    it('pkce config is frozen', async () => {
      const { haipConfig } = await loadFresh();
      expect(Object.isFrozen(haipConfig.pkce)).toBe(true);
    });

    it('par config is frozen', async () => {
      const { haipConfig } = await loadFresh();
      expect(Object.isFrozen(haipConfig.par)).toBe(true);
    });
  });

  // ── Environment variable overrides ────────────────────────

  describe('environment variable overrides', () => {
    it('uses 5 minute replay TTL by default', async () => {
      const { haipConfig } = await loadFresh();
      expect(haipConfig.dpop.jtiReplayTtlMs).toBe(300000);
    });

    it('respects DPOP_MAX_CLOCK_SKEW_SECONDS', async () => {
      process.env.HAIP_ENFORCE = 'false';
      process.env.DPOP_MAX_CLOCK_SKEW_SECONDS = '120';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.dpop.maxClockSkewSeconds).toBe(120);
    });

    it('respects C_NONCE_LIFETIME_SECONDS', async () => {
      process.env.C_NONCE_LIFETIME_SECONDS = '600';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.nonce.cNonceLifetimeSeconds).toBe(600);
    });

    it('cannot disable PKCE when HAIP enforced', async () => {
      process.env.HAIP_ENFORCE = 'true';
      process.env.PKCE_REQUIRED = 'false';
      const { haipConfig } = await loadFresh();
      // HAIP enforcement overrides the env var
      expect(haipConfig.pkce.required).toBe(true);
    });

    it('can disable PKCE when HAIP not enforced', async () => {
      process.env.HAIP_ENFORCE = 'false';
      process.env.PKCE_REQUIRED = 'false';
      const { haipConfig } = await loadFresh();
      expect(haipConfig.pkce.required).toBe(false);
    });
  });
});
