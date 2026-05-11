/**
 * W3-PR200A — Wallet Activation Reality Pass.
 *
 * Locks the wallet-SDK truth contract:
 *   - diagnostics no longer hardcode "ok" for absent state
 *   - the SDK introspection surface matches reality (listCredentials,
 *     createPresentation, respondToOID4VPRequest, acceptCredentialOffer)
 *   - replay-safety is derived from the surface, not asserted
 *   - offline presentation envelopes without a nonce are flagged
 *   - the assertion CI helper gates correctly on real findings
 *
 * Doctrine link: governance-runtime R-AMBIGUOUS principle — unknown
 * state never silently classifies as healthy.
 */

import { describe, expect, it } from 'vitest';

import {
  runDiagnostics,
  assertWalletActivationReality,
  type WalletSurfaceProbe,
} from '../diagnostics';

const NOW = '2026-05-11T00:00:00Z';

function completeProbe(): WalletSurfaceProbe {
  return {
    listCredentials: () => undefined,
    getCredential: () => undefined,
    createPresentation: () => undefined,
    createOfflinePresentation: () => undefined,
    presentSelectiveDisclosure: () => undefined,
    respondToOID4VPRequest: () => undefined,
    acceptCredentialOffer: () => undefined,
    getSummary: () => undefined,
    getTrustState: () => undefined,
  };
}

describe('W3-PR200A — runDiagnostics: no-probe ambiguity-visible default', () => {
  const diag = runDiagnostics();

  it('emits walletSurfaceProbed=warn when no probe is supplied', () => {
    const probed = diag.checks.find((c) => c.name === 'walletSurfaceProbed');
    expect(probed?.status).toBe('warn');
  });

  it('does NOT silently claim health when surface is unknown', () => {
    expect(diag.overallHealth).not.toBe('healthy');
  });

  it('replaySafe is false when no probe supplied', () => {
    expect(diag.replaySafe).toBe(false);
  });

  it('does not emit fictional hasStoreFn / hasListFn check names', () => {
    const names = diag.checks.map((c) => c.name);
    expect(names).not.toContain('hasStoreFn');
    expect(names).not.toContain('hasListFn');
    expect(names).not.toContain('hasSelectiveDisclosureFn');
  });

  it('checks array is frozen', () => {
    expect(Object.isFrozen(diag.checks)).toBe(true);
  });

  it('diagnostics result is frozen', () => {
    expect(Object.isFrozen(diag)).toBe(true);
  });
});

describe('W3-PR200A — runDiagnostics: complete probe', () => {
  const diag = runDiagnostics(completeProbe());

  it('rolls up to degraded because canReachApi stays warn in static mode', () => {
    expect(diag.overallHealth).toBe('degraded');
  });

  it('replaySafe is true when both OID4VP responder and offline path are exposed', () => {
    expect(diag.replaySafe).toBe(true);
  });

  it('emits real check names matching the SDK surface', () => {
    const names = diag.checks.map((c) => c.name);
    expect(names).toContain('hasListCredentials');
    expect(names).toContain('hasCreatePresentation');
    expect(names).toContain('hasOID4VPResponder');
    expect(names).toContain('hasOID4VCIAcceptOffer');
    expect(names).toContain('hasTrustStateReadback');
    expect(names).toContain('replaySafePresentation');
  });

  it('canReachApi is warn (static diagnostics cannot prove reachability)', () => {
    const c = diag.checks.find((c) => c.name === 'canReachApi');
    expect(c?.status).toBe('warn');
  });
});

describe('W3-PR200A — runDiagnostics: surface gaps fail-close', () => {
  it('missing listCredentials triggers fail', () => {
    const probe: WalletSurfaceProbe = { ...completeProbe(), listCredentials: undefined };
    const diag = runDiagnostics(probe);
    const c = diag.checks.find((c) => c.name === 'hasListCredentials');
    expect(c?.status).toBe('fail');
    expect(diag.overallHealth).toBe('critical');
  });

  it('missing OID4VP responder triggers fail AND drops replaySafe to false', () => {
    const probe: WalletSurfaceProbe = {
      ...completeProbe(),
      respondToOID4VPRequest: undefined,
    };
    const diag = runDiagnostics(probe);
    const c = diag.checks.find((c) => c.name === 'hasOID4VPResponder');
    expect(c?.status).toBe('fail');
    expect(diag.replaySafe).toBe(false);
  });

  it('missing OID4VCI accept-offer triggers fail (credential intake blocked)', () => {
    const probe: WalletSurfaceProbe = {
      ...completeProbe(),
      acceptCredentialOffer: undefined,
    };
    const diag = runDiagnostics(probe);
    const c = diag.checks.find((c) => c.name === 'hasOID4VCIAcceptOffer');
    expect(c?.status).toBe('fail');
  });

  it('missing selective-disclosure degrades but does not fail (warn-only)', () => {
    const probe: WalletSurfaceProbe = {
      ...completeProbe(),
      presentSelectiveDisclosure: undefined,
    };
    const diag = runDiagnostics(probe);
    const c = diag.checks.find((c) => c.name === 'hasSelectiveDisclosure');
    expect(c?.status).toBe('warn');
  });
});

describe('W3-PR200A — assertWalletActivationReality: replay/portability findings', () => {
  it('no probe + no envelope → multiple findings + CI gating', () => {
    const r = assertWalletActivationReality(null, null, NOW);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it('complete probe + envelope missing nonce → replay-vulnerable finding', () => {
    const r = assertWalletActivationReality(
      completeProbe(),
      { mode: 'offline', credentialIds: ['c1'] },
      NOW,
    );
    expect(r.findings.some((f) => /no anti-replay nonce/.test(f))).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it('complete probe + envelope without mode=offline → replay-ambiguous finding', () => {
    const r = assertWalletActivationReality(
      completeProbe(),
      { credentialIds: ['c1'], nonce: 'abc123' },
      NOW,
    );
    expect(r.findings.some((f) => /mode=offline/.test(f))).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it('complete probe + properly nonced offline envelope → no findings', () => {
    const r = assertWalletActivationReality(
      completeProbe(),
      { mode: 'offline', credentialIds: ['c1'], nonce: 'fresh-nonce' },
      NOW,
    );
    expect(r.findings).toHaveLength(0);
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it('critical SDK surface triggers diagnostic-critical finding', () => {
    const broken: WalletSurfaceProbe = {
      // Missing every required callable
      getSummary: () => undefined,
    };
    const r = assertWalletActivationReality(
      broken,
      { mode: 'offline', credentialIds: ['c1'], nonce: 'n' },
      NOW,
    );
    expect(r.findings.some((f) => /critical/.test(f))).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it('result + findings array are frozen', () => {
    const r = assertWalletActivationReality(null, null, NOW);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.findings)).toBe(true);
  });

  it('executedAt round-trips the supplied ISO string', () => {
    const r = assertWalletActivationReality(null, null, NOW);
    expect(r.executedAt).toBe(NOW);
  });
});

describe('W3-PR200A — wallet-sdk public surface matches diagnostic claims', () => {
  it('the live VitalCVWallet class exposes every method the diagnostic introspects', async () => {
    const mod = await import('../index');
    const wallet = new mod.VitalCVWallet({
      baseUrl: 'http://localhost',
      npi: '1234567890',
    });
    expect(typeof wallet.listCredentials).toBe('function');
    expect(typeof wallet.getCredential).toBe('function');
    expect(typeof wallet.createPresentation).toBe('function');
    expect(typeof wallet.createOfflinePresentation).toBe('function');
    expect(typeof wallet.presentSelectiveDisclosure).toBe('function');
    expect(typeof wallet.respondToOID4VPRequest).toBe('function');
    expect(typeof wallet.acceptCredentialOffer).toBe('function');
    expect(typeof wallet.getSummary).toBe('function');
    expect(typeof wallet.getTrustState).toBe('function');
  });

  it('runDiagnostics(wallet) rolls up to degraded (only canReachApi warns) for a real wallet', async () => {
    const mod = await import('../index');
    const wallet = new mod.VitalCVWallet({
      baseUrl: 'http://localhost',
      npi: '1234567890',
    });
    const diag = runDiagnostics(wallet as unknown as WalletSurfaceProbe);
    expect(diag.overallHealth).toBe('degraded');
    expect(diag.replaySafe).toBe(true);
  });
});
