/**
 * PQC must actually load — not silently fall back to classical.
 *
 * `cryptoRegistry.loadPQC()` wraps its `require` in a try/catch that logs a
 * WARN and leaves the module handles null. That is the right runtime posture
 * (the API should boot without PQC rather than crash), but it means a broken
 * import specifier is INVISIBLE except in logs. Production ran that way:
 *
 *   [WARN] cryptoRegistry: PQC algorithms unavailable — using classical only
 *   ERR_PACKAGE_PATH_NOT_EXPORTED: './ml-dsa' is not defined by "exports"
 *
 * `@noble/post-quantum@0.5.x` declares `./ml-dsa.js` and `./slh-dsa.js` in its
 * exports map, and Node matches those keys literally, so the extensionless
 * subpath throws even though the package is installed.
 *
 * These tests assert the OUTCOME — a real ML-DSA-65 / SLH-DSA-128s signature
 * round-trips — rather than grepping the source for a `.js` suffix. A guard
 * that pinned the specifier string would go green against a future fix that
 * solved the same problem a different way (a version bump that restores the
 * extensionless alias, say), while this one keeps testing the thing we care
 * about: post-quantum signing works.
 */

import {
  initializeCryptoKeys,
  signWithSuite,
  verifyWithSuite,
  keyStore,
} from '../src/services/crypto/cryptoRegistry';

type PqcSuite = 'ml-dsa-65' | 'slh-dsa-128s';
const PQC_SUITES: PqcSuite[] = ['ml-dsa-65', 'slh-dsa-128s'];

describe('PQC subpath contract — post-quantum signing is actually available', () => {
  beforeAll(async () => {
    await initializeCryptoKeys();
  });

  it('the installed package resolves the .js subpaths (diagnostic, not the guard)', () => {
    // Deliberately hardcodes the suffix rather than reading the source, so it
    // isolates ONE question: does the installed package still provide these
    // subpaths? It therefore stays green when cryptoRegistry regresses — the
    // behavioural tests below are the actual guard. Its job is to tell you,
    // when they go red, whether the package changed or the caller did.
    expect(() => require('@noble/post-quantum/ml-dsa.js')).not.toThrow();
    expect(() => require('@noble/post-quantum/slh-dsa.js')).not.toThrow();
  });

  it.each(PQC_SUITES)('%s has an active key after initialization', (suite: PqcSuite) => {
    // If loadPQC() silently failed, keygen threw and no key was registered.
    // This is the assertion that would have caught the production regression.
    expect(keyStore.activeKeyForSuite(suite)).toBeTruthy();
  });

  it.each(PQC_SUITES)('%s signs and verifies a real payload', async (suite: PqcSuite) => {
    const payload = new TextEncoder().encode('vitalcv pqc subpath contract');

    const signed = await signWithSuite(payload, suite);
    expect(signed.suiteId).toBe(suite);
    expect(signed.signatureHex.length).toBeGreaterThan(0);

    const verified = await verifyWithSuite(payload, signed.signatureHex, signed.keyId);
    expect(verified.valid).toBe(true);
    expect(verified.suiteId).toBe(suite);
  });

  it.each(PQC_SUITES)('%s rejects a tampered payload', async (suite: PqcSuite) => {
    // Proves the verify path is real rather than a stub that returns true.
    const payload = new TextEncoder().encode('vitalcv pqc subpath contract');
    const signed = await signWithSuite(payload, suite);

    const tampered = new TextEncoder().encode('vitalcv pqc subpath contracT');
    const verified = await verifyWithSuite(tampered, signed.signatureHex, signed.keyId);
    expect(verified.valid).toBe(false);
  });
});
