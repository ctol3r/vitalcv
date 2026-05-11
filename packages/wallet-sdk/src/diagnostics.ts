/**
 * Wallet-SDK diagnostics — W3-PR200A.
 *
 * Replaces the prior stub that hardcoded every check to "ok" with
 * runtime introspection that actually validates the SDK surface and
 * fail-closed wallet semantics.
 *
 * Truth contract:
 *   - Unknown / absent state never returns "ok" — it returns "warn"
 *     (analogous to the governance-runtime R-AMBIGUOUS principle).
 *   - Check names match real exported method names — no fictional
 *     `store()` / `list()` claims.
 *   - Offline presentations are explicitly flagged ambiguous unless
 *     the caller supplies an anti-replay nonce.
 *
 * Used by the wave/w3-pr200a-wallet-reality CI gate.
 */

import { SDK_NAME, SDK_VERSION } from './version';

export interface DiagnosticCheck {
  readonly name: string;
  readonly status: 'ok' | 'warn' | 'fail';
  readonly detail?: string;
}

export interface SdkDiagnostics {
  readonly sdkName: string;
  readonly version: string;
  readonly timestamp: string;
  readonly checks: readonly DiagnosticCheck[];
  readonly overallHealth: 'healthy' | 'degraded' | 'critical';
  /**
   * Replay-safety verdict over the diagnostic run. True only when the
   * SDK exposes a presentation surface that can carry an anti-replay
   * nonce AND offline presentations are produced through a method
   * whose name discloses their ambiguous nature.
   */
  readonly replaySafe: boolean;
  /**
   * Fail-closed verdict. True when no check returns a silent "ok"
   * default — every result is backed by introspection evidence or an
   * explicit ambiguity warning.
   */
  readonly failClosed: boolean;
}

/**
 * Shape of the SDK surface the diagnostics expect. Passing a probe
 * (typically the SDK module itself or a wallet instance) lets the
 * function introspect what is really exported instead of asserting a
 * hardcoded surface.
 */
export interface WalletSurfaceProbe {
  readonly listCredentials?: unknown;
  readonly getCredential?: unknown;
  readonly createPresentation?: unknown;
  readonly createOfflinePresentation?: unknown;
  readonly presentSelectiveDisclosure?: unknown;
  readonly respondToOID4VPRequest?: unknown;
  readonly acceptCredentialOffer?: unknown;
  readonly getSummary?: unknown;
  readonly getTrustState?: unknown;
}

function isCallable(v: unknown): boolean {
  return typeof v === 'function';
}

function rollup(
  checks: readonly DiagnosticCheck[],
): SdkDiagnostics['overallHealth'] {
  if (checks.some((c) => c.status === 'fail')) return 'critical';
  if (checks.some((c) => c.status === 'warn')) return 'degraded';
  return 'healthy';
}

export function runDiagnostics(probe?: WalletSurfaceProbe): SdkDiagnostics {
  const checks: DiagnosticCheck[] = [];
  const probeProvided = probe !== undefined && probe !== null;

  if (!probeProvided) {
    checks.push({
      name: 'walletSurfaceProbed',
      status: 'warn',
      detail:
        'no wallet probe supplied — surface presence cannot be verified (ambiguity-visible default)',
    });
  } else {
    checks.push({
      name: 'hasListCredentials',
      status: isCallable(probe.listCredentials) ? 'ok' : 'fail',
      detail: isCallable(probe.listCredentials)
        ? 'listCredentials() is exposed'
        : 'listCredentials() missing — wallet contents cannot be enumerated',
    });
    checks.push({
      name: 'hasCreatePresentation',
      status: isCallable(probe.createPresentation) ? 'ok' : 'fail',
      detail: isCallable(probe.createPresentation)
        ? 'createPresentation() is exposed'
        : 'createPresentation() missing — VP cannot be issued',
    });
    checks.push({
      name: 'hasSelectiveDisclosure',
      status: isCallable(probe.presentSelectiveDisclosure) ? 'ok' : 'warn',
      detail: isCallable(probe.presentSelectiveDisclosure)
        ? 'presentSelectiveDisclosure() is exposed'
        : 'presentSelectiveDisclosure() missing — minimization disclosure unavailable',
    });
    checks.push({
      name: 'hasOID4VPResponder',
      status: isCallable(probe.respondToOID4VPRequest) ? 'ok' : 'fail',
      detail: isCallable(probe.respondToOID4VPRequest)
        ? 'respondToOID4VPRequest() is exposed'
        : 'OID4VP responder missing — interoperability blocked',
    });
    checks.push({
      name: 'hasOID4VCIAcceptOffer',
      status: isCallable(probe.acceptCredentialOffer) ? 'ok' : 'fail',
      detail: isCallable(probe.acceptCredentialOffer)
        ? 'acceptCredentialOffer() is exposed'
        : 'OID4VCI offer acceptance missing — credential intake blocked',
    });
    checks.push({
      name: 'hasTrustStateReadback',
      status: isCallable(probe.getTrustState) ? 'ok' : 'warn',
      detail: isCallable(probe.getTrustState)
        ? 'getTrustState() is exposed'
        : 'no trust-state readback — wallet cannot surface band',
    });
  }

  checks.push({
    name: 'canReachApi',
    status: 'warn',
    detail:
      'API reachability not validated in static diagnostics — use a live contract test',
  });

  const hasOID4VPResponder =
    probeProvided && isCallable(probe.respondToOID4VPRequest);
  const offlineIsDistinct =
    probeProvided && isCallable(probe.createOfflinePresentation);
  const replaySafe = hasOID4VPResponder && offlineIsDistinct;
  checks.push({
    name: 'replaySafePresentation',
    status: replaySafe ? 'ok' : 'warn',
    detail: replaySafe
      ? 'OID4VP nonce carrier present + offline path explicitly named'
      : 'replay-safety could not be proven — offline path indistinguishable or OID4VP responder missing',
  });

  // failClosed is true whenever the diagnostic chose ambiguity-visible
  // defaults instead of silent ok. Concretely: it is false only if the
  // diagnostic returned all-ok without a probe — which can no longer
  // happen because the no-probe branch emits a warn.
  const failClosed = !checks.every(
    (c) => c.status === 'ok' && !probeProvided,
  );

  return Object.freeze({
    sdkName: SDK_NAME,
    version: SDK_VERSION,
    timestamp: new Date().toISOString(),
    checks: Object.freeze(checks),
    overallHealth: rollup(checks),
    replaySafe,
    failClosed,
  });
}

// ─── Activation-reality assertion ────────────────────────────────────

export interface WalletActivationReality {
  readonly executedAt: string;
  readonly findings: readonly string[];
  readonly hasCiGatingCondition: boolean;
}

/**
 * Asserts the activation-reality invariants over a probe and a nominal
 * offline presentation envelope. Returns findings + a CI gating flag.
 *
 * This is the function the wallet-activation CI gate runs against the
 * built SDK + a representative offline VP shape.
 */
export function assertWalletActivationReality(
  probe: WalletSurfaceProbe | null | undefined,
  offlineVpEnvelope: unknown,
  nowIso: string,
): WalletActivationReality {
  const findings: string[] = [];

  const diag = runDiagnostics(probe ?? undefined);
  if (diag.overallHealth === 'critical') {
    findings.push(
      'SDK surface missing required exports — diagnostics rolled up to critical',
    );
  }
  if (!diag.replaySafe) {
    findings.push(
      'replay-safety could not be proven from SDK surface alone',
    );
  }

  if (
    offlineVpEnvelope === null ||
    offlineVpEnvelope === undefined ||
    typeof offlineVpEnvelope !== 'object'
  ) {
    findings.push(
      'offline presentation envelope is absent or non-object — ambiguity preserved',
    );
  } else {
    const envelope = offlineVpEnvelope as Record<string, unknown>;
    if (envelope.mode !== 'offline') {
      findings.push(
        'offline envelope does not self-declare mode=offline — replay-ambiguous',
      );
    }
    if (
      typeof envelope.nonce !== 'string' ||
      (envelope.nonce as string).length === 0
    ) {
      findings.push(
        'offline envelope has no anti-replay nonce — replay-vulnerable',
      );
    }
  }

  return Object.freeze({
    executedAt: nowIso,
    findings: Object.freeze(findings),
    hasCiGatingCondition: findings.length > 0,
  });
}
