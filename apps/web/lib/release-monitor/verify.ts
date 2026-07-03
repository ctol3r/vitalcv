/**
 * Release-verification orchestration (pure over injected probes).
 *
 * Sequences the post-deploy checks and produces one structured pass/fail
 * report. All I/O is injected so the ordering, pass/fail logic, and the
 * cleanup-always guarantee are unit-testable without network or timers. The
 * sleepy part — polling `/api/version` until the container serves the target
 * commit — lives in the runner (`scripts/release-verify.ts`), which resolves
 * `containerSha`/`mainSha` and passes them in as data.
 *
 * Check model: each check carries `critical`. `overall` fails iff any critical
 * check fails. The signed-in `/holder` reachability + `check:deploy` are
 * critical; `/auth/resolving` and (for non-webhook runs) SHA-match are reported
 * but non-critical — see the doc for the benign non-web-commit lag rationale.
 */

import { HOLDER_ROUTES, pathOf, type NavOutcome } from './holderRoutes';
import type { ClinicianSession, CleanupResult, MintResult, WarmUpResult } from './syntheticClinician';

export interface ReleaseCheck {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

export interface ReleaseVerificationReport {
  startedAt: string;
  finishedAt: string;
  base: string;
  /** Deploy commit from the webhook client_payload, if this run is deploy-scoped. */
  targetSha: string | null;
  mainSha: string | null;
  containerSha: string | null;
  checks: ReleaseCheck[];
  overall: 'pass' | 'fail';
  failedChecks: string[];
  cleanup: CleanupResult;
}

export interface VerifyDeps {
  base: string;
  /** Resolved by the runner (after the SHA poll). */
  containerSha: string | null;
  mainSha: string | null;
  /** Deploy commit (webhook). When present, the SHA check is critical. */
  targetSha?: string | null;
  routes?: readonly string[];
  isoNow?: () => string;

  // injected probes — implementations return result shapes, never throw
  probeResolving: () => Promise<{ status: number }>;
  mint: () => Promise<MintResult>;
  warmUp: (session: ClinicianSession) => Promise<WarmUpResult>;
  refresh: (session: ClinicianSession) => Promise<boolean>;
  reach: (session: ClinicianSession, path: string) => Promise<NavOutcome>;
  runDeployCheck: () => Promise<{ ok: boolean; detail: string }>;
  cleanup: (created: { userId: string | null; orgId: string | null }) => Promise<CleanupResult>;
}

function short(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 9) : '∅';
}

export async function runReleaseVerification(deps: VerifyDeps): Promise<ReleaseVerificationReport> {
  const isoNow = deps.isoNow ?? (() => new Date().toISOString());
  const startedAt = isoNow();
  const routes = deps.routes ?? HOLDER_ROUTES;
  const checks: ReleaseCheck[] = [];
  let created: { userId: string | null; orgId: string | null } = { userId: null, orgId: null };
  let cleanup: CleanupResult = { attempted: false, ok: true, detail: 'not reached' };

  try {
    // 1. Deployed web SHA. effectiveTarget = the deploy commit (webhook) or main HEAD.
    const effectiveTarget = deps.targetSha ?? deps.mainSha;
    const shaCritical = Boolean(deps.targetSha);
    const shaOk = Boolean(
      deps.containerSha && effectiveTarget && deps.containerSha.toLowerCase() === effectiveTarget.toLowerCase(),
    );
    checks.push({
      name: 'web_sha',
      ok: shaOk,
      critical: shaCritical,
      detail: shaOk
        ? `container ${short(deps.containerSha)} == ${deps.targetSha ? 'deploy' : 'main'} ${short(effectiveTarget)}`
        : `container ${short(deps.containerSha)} != ${short(effectiveTarget)} (${
            deps.targetSha ? 'deploy commit — new code not serving' : 'main HEAD — possible benign non-web-commit lag'
          })`,
    });

    // 2. Public interstitial reachability (reported).
    const resolving = await deps.probeResolving();
    checks.push({
      name: 'auth_resolving',
      ok: resolving.status === 200,
      critical: false,
      detail: `/auth/resolving → ${resolving.status}${resolving.status === 404 ? ' (interstitial not deployed)' : ''}`,
    });

    // 3. Mint a synthetic clinician session.
    const minted = await deps.mint();
    created = minted.created;
    if (!minted.ok || !minted.session) {
      checks.push({ name: 'synthetic_session', ok: false, critical: true, detail: minted.error ?? 'mint failed' });
      for (const r of routes) {
        checks.push({ name: `holder:${r}`, ok: false, critical: true, detail: 'skipped — no session' });
      }
    } else {
      const session = minted.session;
      checks.push({ name: 'synthetic_session', ok: true, critical: true, detail: `minted clinician ${session.userId}` });

      // 4. Cold-start navigation — the P0 detector.
      const warm = await deps.warmUp(session);
      checks.push({
        name: 'holder:cold-start',
        ok: warm.ok,
        critical: true,
        detail: warm.ok
          ? `resolved in ${warm.hops.length} hop(s)`
          : `cold /holder failed: ${warm.reason} [${warm.hops.map((h) => `${pathOf(h.url)}→${h.status}`).join(' ')}]`,
      });

      // 5. Widen the 60s JWT window before the sweep (best-effort, not a check).
      await deps.refresh(session);

      // 6. Steady-state reachability of every required route.
      for (const r of routes) {
        const outcome = await deps.reach(session, r);
        checks.push({
          name: `holder:${r}`,
          ok: outcome.ok,
          critical: true,
          detail: outcome.ok
            ? `200 in ${outcome.hops} hop(s)`
            : `${outcome.reason ?? 'fail'} (final ${outcome.finalStatus ?? '∅'} ${outcome.finalUrl ?? ''})`,
        });
      }
    }

    // 7. Deployment integrity (pnpm check:deploy).
    const deploy = await deps.runDeployCheck();
    checks.push({ name: 'deploy_integrity', ok: deploy.ok, critical: true, detail: deploy.detail });
  } finally {
    try {
      cleanup = await deps.cleanup(created);
    } catch (err) {
      cleanup = { attempted: true, ok: false, detail: `cleanup threw: ${(err as Error).message}` };
    }
  }

  const failedChecks = checks.filter((c) => c.critical && !c.ok).map((c) => c.name);
  return {
    startedAt,
    finishedAt: isoNow(),
    base: deps.base,
    targetSha: deps.targetSha ?? null,
    mainSha: deps.mainSha ?? null,
    containerSha: deps.containerSha ?? null,
    checks,
    overall: failedChecks.length ? 'fail' : 'pass',
    failedChecks,
    cleanup,
  };
}
