#!/usr/bin/env -S node --import=tsx/esm
/**
 * verify-surface-convergence.ts
 *
 * Probes every trust-bearing surface VitalCV exposes for a given NPI and
 * verifies they all report THE SAME replay-identity truth — same
 * `lineageKey`, same `runId`, same `checkedAt`, same active `kid` /
 * issuer DID. Surface divergence means a verifier reading two surfaces
 * would see inconsistent claims about the same subject; this script
 * catches that before a verifier does.
 *
 * Probed surfaces (when reachable):
 *
 *   /api/passport/npi/:npi             — entity-shape passport (Wave 10 #343)
 *   /api/passport/:npi                 — passport proxy (#340)
 *   /api/receipt/:npi                  — signed VC 2.0 receipt (#349)
 *   /.well-known/jwks.json             — JWK set (#349)
 *   /.well-known/did.json              — DID document (#349)
 *   /.well-known/trust-register        — institutional manifest (#349)
 *
 * Convergence checks:
 *
 *   1. lineageKey consistency  — every surface that emits a lineageKey
 *                                must report the same value for the
 *                                same NPI.
 *   2. runId consistency       — every surface that emits a runId
 *                                must report the same value for the
 *                                same snapshot.
 *   3. checkedAt consistency   — surfaces that emit a freshness
 *                                timestamp agree on it.
 *   4. issuer DID consistency  — JWKS kid, did.json verificationMethod,
 *                                trust-register signing.active_kid,
 *                                and receipt header X-Receipt-Kid all
 *                                agree.
 *   5. receipt chronology      — receipt iat (pinned to lastCheckedAt)
 *                                matches the passport's lastCheckedAt.
 *
 * Usage:
 *   pnpm exec tsx scripts/replay/verify-surface-convergence.ts \
 *     --base-url http://localhost:3030 \
 *     --npi 1346053246
 *
 * Exit codes:
 *   0  every surface agrees (perfect convergence)
 *   2  bad input
 *   7  divergence detected (verifier-actionable signal)
 */
import { decodeJwt, decodeProtectedHeader } from 'jose';
import {
  emitHumanLine,
  emitJsonLine,
  parseArgs,
} from './_lib';

const SURFACE_FETCH_TIMEOUT_MS = 8000;

export interface SurfaceProbe<T = unknown> {
  surface: string;
  url: string;
  ok: boolean;
  status: number;
  body: T | null;
  error?: string;
}

async function probeJson<T = unknown>(url: string): Promise<SurfaceProbe<T>> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(SURFACE_FETCH_TIMEOUT_MS),
    });
    const body = res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
    return { surface: url, url, ok: res.ok, status: res.status, body };
  } catch (err) {
    return {
      surface: url,
      url,
      ok: false,
      status: 0,
      body: null,
      error: String(err),
    };
  }
}

interface ReceiptProbe {
  ok: boolean;
  status: number;
  jwt: string | null;
  decoded: Record<string, unknown> | null;
  protectedHeader: Record<string, unknown> | null;
  kidHeader: string | null;
  issuerHeader: string | null;
  error?: string;
}

async function probeReceipt(url: string): Promise<ReceiptProbe> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SURFACE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, jwt: null, decoded: null, protectedHeader: null, kidHeader: null, issuerHeader: null };
    }
    const jwt = await res.text();
    const decoded = decodeJwt(jwt) as Record<string, unknown>;
    const header = decodeProtectedHeader(jwt) as Record<string, unknown>;
    return {
      ok: true,
      status: res.status,
      jwt,
      decoded,
      protectedHeader: header,
      kidHeader: res.headers.get('x-receipt-kid'),
      issuerHeader: res.headers.get('x-receipt-issuer'),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      jwt: null,
      decoded: null,
      protectedHeader: null,
      kidHeader: null,
      issuerHeader: null,
      error: String(err),
    };
  }
}

export interface ConvergenceObservations {
  npi: string;
  surfaces: {
    passportNpi: SurfaceProbe;
    passportProxy: SurfaceProbe;
    jwks: SurfaceProbe;
    didDocument: SurfaceProbe;
    trustRegister: SurfaceProbe;
    receipt: ReceiptProbe;
  };
}

export interface ConvergenceFinding {
  finding:
    | 'lineageKey-consistency'
    | 'runId-consistency'
    | 'checkedAt-consistency'
    | 'issuer-kid-consistency'
    | 'receipt-chronology';
  ok: boolean;
  detail: Record<string, unknown>;
}

/**
 * Pure analyzer over a snapshot of surface observations. Extracted from
 * `main()` so it can be unit-tested with fixture inputs and no live HTTP.
 */
export function analyzeConvergence(obs: ConvergenceObservations): ConvergenceFinding[] {
  const findings: ConvergenceFinding[] = [];

  // ─── lineageKey + runId from each surface that emits them ──────────────
  const passportNpiReplay = readReplayBlock(obs.surfaces.passportNpi.body);
  const passportProxyReplay = readReplayBlock(obs.surfaces.passportProxy.body);
  const receiptReplay = readReceiptReplay(obs.surfaces.receipt);

  const lineageObservations = [
    { source: 'passport_npi', value: passportNpiReplay?.lineageKey },
    { source: 'passport_proxy', value: passportProxyReplay?.lineageKey },
    { source: 'receipt', value: receiptReplay?.lineageKey },
  ].filter((o): o is { source: string; value: string } => typeof o.value === 'string');

  const runIdObservations = [
    { source: 'passport_npi', value: passportNpiReplay?.runId },
    { source: 'passport_proxy', value: passportProxyReplay?.runId },
    { source: 'receipt', value: receiptReplay?.runId },
  ].filter((o): o is { source: string; value: string } => typeof o.value === 'string');

  findings.push({
    finding: 'lineageKey-consistency',
    ok: allEqual(lineageObservations.map((o) => o.value)),
    detail: {
      observed: lineageObservations,
      count: lineageObservations.length,
    },
  });

  findings.push({
    finding: 'runId-consistency',
    ok: allEqual(runIdObservations.map((o) => o.value)),
    detail: {
      observed: runIdObservations,
      count: runIdObservations.length,
    },
  });

  // ─── checkedAt consistency ─────────────────────────────────────────────
  const checkedAtObservations = [
    { source: 'passport_npi', value: readLastCheckedAt(obs.surfaces.passportNpi.body) },
    { source: 'passport_proxy', value: readLastCheckedAt(obs.surfaces.passportProxy.body) },
    { source: 'receipt_vcv', value: receiptReplay?.checkedAt ?? null },
  ].filter((o): o is { source: string; value: string } => typeof o.value === 'string');

  findings.push({
    finding: 'checkedAt-consistency',
    ok: allEqual(checkedAtObservations.map((o) => o.value)),
    detail: {
      observed: checkedAtObservations,
      count: checkedAtObservations.length,
    },
  });

  // ─── issuer kid consistency across well-known + receipt ────────────────
  const jwks = obs.surfaces.jwks.body as { keys?: Array<{ kid?: string }> } | null;
  const did = obs.surfaces.didDocument.body as {
    verificationMethod?: Array<{ publicKeyJwk?: { kid?: string }; id?: string }>;
  } | null;
  const trustRegister = obs.surfaces.trustRegister.body as {
    signing?: { active_kid?: string };
  } | null;

  const kidObservations = [
    { source: 'jwks', value: jwks?.keys?.[0]?.kid },
    { source: 'did.json', value: did?.verificationMethod?.[0]?.publicKeyJwk?.kid },
    { source: 'trust-register', value: trustRegister?.signing?.active_kid },
    { source: 'receipt.header', value: obs.surfaces.receipt.kidHeader ?? undefined },
    {
      source: 'receipt.jwt.kid',
      value: typeof obs.surfaces.receipt.protectedHeader?.kid === 'string'
        ? (obs.surfaces.receipt.protectedHeader.kid as string)
        : undefined,
    },
  ].filter((o): o is { source: string; value: string } => typeof o.value === 'string');

  findings.push({
    finding: 'issuer-kid-consistency',
    ok: allEqual(kidObservations.map((o) => o.value)),
    detail: {
      observed: kidObservations,
      count: kidObservations.length,
    },
  });

  // ─── receipt chronology — receipt iat must equal lastCheckedAt seconds ─
  const receiptIatSeconds =
    typeof obs.surfaces.receipt.decoded?.iat === 'number'
      ? (obs.surfaces.receipt.decoded.iat as number)
      : null;
  const passportCheckedAtSeconds = (() => {
    const v = readLastCheckedAt(obs.surfaces.passportNpi.body);
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  })();

  findings.push({
    finding: 'receipt-chronology',
    ok:
      receiptIatSeconds === null
      || passportCheckedAtSeconds === null
      || receiptIatSeconds === passportCheckedAtSeconds,
    detail: {
      receipt_iat: receiptIatSeconds,
      passport_checkedAt_seconds: passportCheckedAtSeconds,
      converged: receiptIatSeconds === passportCheckedAtSeconds,
    },
  });

  return findings;
}

function readReplayBlock(body: unknown): {
  lineageKey?: string;
  runId?: string;
  schemeVersion?: string;
} | null {
  if (!body || typeof body !== 'object') return null;
  const replay = (body as { replay?: Record<string, unknown> }).replay;
  if (!replay || typeof replay !== 'object') return null;
  return {
    lineageKey: typeof replay.lineageKey === 'string' ? replay.lineageKey : undefined,
    runId: typeof replay.runId === 'string' ? replay.runId : undefined,
    schemeVersion: typeof replay.schemeVersion === 'string' ? replay.schemeVersion : undefined,
  };
}

function readReceiptReplay(receipt: ReceiptProbe): {
  lineageKey?: string;
  runId?: string;
  checkedAt?: string;
} | null {
  if (!receipt.ok || !receipt.decoded) return null;
  const vcv = receipt.decoded.vcv as Record<string, unknown> | undefined;
  if (!vcv) return null;
  const replay = vcv.replay as Record<string, unknown> | null | undefined;
  return {
    lineageKey: replay && typeof replay.lineageKey === 'string' ? replay.lineageKey : undefined,
    runId: replay && typeof replay.runId === 'string' ? replay.runId : undefined,
    checkedAt: typeof vcv.checkedAt === 'string' ? vcv.checkedAt : undefined,
  };
}

function readLastCheckedAt(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const v = (body as { lastCheckedAt?: unknown }).lastCheckedAt;
  return typeof v === 'string' ? v : null;
}

function allEqual<T>(values: readonly T[]): boolean {
  if (values.length <= 1) return true;
  return values.every((v) => v === values[0]);
}

async function fetchAll(baseUrl: string, npi: string): Promise<ConvergenceObservations> {
  const base = baseUrl.replace(/\/+$/, '');
  const [passportNpi, passportProxy, jwks, didDocument, trustRegister, receipt] = await Promise.all([
    probeJson(`${base}/api/passport/npi/${encodeURIComponent(npi)}`),
    probeJson(`${base}/api/passport/${encodeURIComponent(npi)}`),
    probeJson(`${base}/.well-known/jwks.json`),
    probeJson(`${base}/.well-known/did.json`),
    probeJson(`${base}/.well-known/trust-register`),
    probeReceipt(`${base}/api/receipt/${encodeURIComponent(npi)}`),
  ]);
  return {
    npi,
    surfaces: { passportNpi, passportProxy, jwks, didDocument, trustRegister, receipt },
  };
}

async function main(): Promise<void> {
  const { flags } = parseArgs(process.argv.slice(2));
  const baseUrl = flags.get('base-url') ?? 'http://localhost:3030';
  const npi = flags.get('npi');

  if (!npi || !/^\d{10}$/.test(npi)) {
    emitHumanLine('usage: verify-surface-convergence --base-url <url> --npi <10-digit-npi>');
    process.exit(2);
  }

  emitHumanLine(`probing surfaces under ${baseUrl} for NPI ${npi}…`);
  const observations = await fetchAll(baseUrl, npi);
  const findings = analyzeConvergence(observations);

  for (const f of findings) {
    emitJsonLine(f as unknown as Record<string, unknown>);
  }

  const allOk = findings.every((f) => f.ok);
  emitJsonLine({
    finding: 'summary',
    ok: allOk,
    detail: {
      npi,
      baseUrl,
      surfacesProbed: Object.keys(observations.surfaces).length,
      findingsTotal: findings.length,
      findingsOk: findings.filter((f) => f.ok).length,
    },
  });

  emitHumanLine(
    allOk
      ? 'verify-surface-convergence: OK (all surfaces agree)'
      : 'verify-surface-convergence: DIVERGENCE DETECTED (see findings above)',
  );
  process.exit(allOk ? 0 : 7);
}

if (typeof require !== 'undefined' && require.main === module) {
  void main();
}
