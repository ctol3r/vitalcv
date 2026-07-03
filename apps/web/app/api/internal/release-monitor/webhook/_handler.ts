/**
 * Railway deploy-webhook receiver — the bridge from a Railway deploy to the
 * external GitHub Actions verification.
 *
 * Runs in the web container but does NO verification itself: it authenticates
 * the caller, decides whether the payload is a web-service SUCCESS deploy, and
 * fires a GitHub `repository_dispatch` so the harness runs on a runner *outside*
 * the container it's testing (the P0 root cause was an in-container hairpin
 * self-fetch). Returns fast.
 *
 * Lives in `_handler.ts` so `route.ts` stays narrowly typed to Next's allowed
 * route exports; tests import `__handleForTests`.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { parseRailwayDeployEvent, shouldTriggerVerification } from '@/lib/release-monitor/railwayWebhook';
import {
  dispatchReleaseVerify,
  type DispatchResult,
  type FetchLike,
  type GithubDispatchInput,
} from '@/lib/release-monitor/githubDispatch';

export interface WebhookEnv {
  releaseToken?: string;
  cronSecret?: string;
  monitoringSecret?: string;
  githubToken?: string;
  repo?: string;
  webServiceName?: string;
  environmentName?: string;
}

export interface WebhookDeps {
  env?: WebhookEnv;
  dispatch?: (input: GithubDispatchInput, fetchImpl?: FetchLike) => Promise<DispatchResult>;
  fetchImpl?: FetchLike;
}

export function readWebhookEnv(): WebhookEnv {
  return {
    releaseToken: process.env.RELEASE_WEBHOOK_TOKEN,
    cronSecret: process.env.CRON_SECRET,
    monitoringSecret: process.env.MONITORING_SECRET,
    githubToken: process.env.GITHUB_DISPATCH_TOKEN,
    repo: process.env.RELEASE_MONITOR_REPO,
    webServiceName: process.env.RELEASE_WEB_SERVICE_NAME,
    environmentName: process.env.RELEASE_MONITOR_ENVIRONMENT,
  };
}

/** Railway deploy payloads are small; anything bigger is not a deploy event. */
const MAX_WEBHOOK_BODY_BYTES = 100_000;

const HEX_SHA = /^[0-9a-f]{7,40}$/i;

/**
 * Bound + validate the fields forwarded to the workflow. The webhook payload
 * is authenticated but still EXTERNAL input, and client_payload values are
 * consumed by CI — never forward them verbatim. `commit` must be a hex SHA
 * (the workflow additionally re-validates before use); free-text fields are
 * truncated.
 */
export function sanitizeClientPayload(event: {
  deploymentId: string | null;
  commit: string | null;
  serviceName: string | null;
  environmentName: string | null;
} | null): Record<string, string | null> {
  const bounded = (v: string | null | undefined, max = 200): string | null =>
    v ? v.slice(0, max) : null;
  return {
    source: 'railway-webhook',
    deploymentId: bounded(event?.deploymentId ?? null),
    commit: event?.commit && HEX_SHA.test(event.commit) ? event.commit : null,
    service: bounded(event?.serviceName ?? null),
    environment: bounded(event?.environmentName ?? null),
  };
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8');
  const bBuf = Buffer.from(b, 'utf-8');
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf); // consume time; still fail closed
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Authenticate the webhook. Accepts the shared secret via `Authorization:
 * Bearer`, `x-monitoring-secret`, or a `?token=` query param (Railway webhooks
 * may only allow a URL). Any configured secret (RELEASE_WEBHOOK_TOKEN /
 * CRON_SECRET / MONITORING_SECRET) is a valid match. Fails closed if none set.
 */
export function authenticateWebhook(
  req: Request,
  env: WebhookEnv,
): { ok: true } | { ok: false; status: 401 | 500; body: { error: string } } {
  const secrets = [env.releaseToken, env.cronSecret, env.monitoringSecret].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  if (secrets.length === 0) {
    return { ok: false, status: 500, body: { error: 'no webhook auth configured' } };
  }

  const url = new URL(req.url);
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')?.trim() ?? '')?.[1]?.trim();
  const candidates = [
    bearer,
    req.headers.get('x-monitoring-secret')?.trim(),
    url.searchParams.get('token')?.trim(),
  ].filter((c): c is string => Boolean(c));

  for (const cand of candidates) {
    for (const secret of secrets) {
      if (safeEqual(cand, secret.trim())) return { ok: true };
    }
  }
  return { ok: false, status: 401, body: { error: 'unauthorized' } };
}

export async function handleWebhook(req: Request, deps: WebhookDeps = {}): Promise<NextResponse> {
  const env = deps.env ?? readWebhookEnv();

  const auth = authenticateWebhook(req, env);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  // Bound the body before parsing — a deploy event is a few KB; anything
  // larger is not one. Content-Length catches the declared case, the
  // post-read length check catches chunked bodies.
  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 });
  }

  let payload: unknown = null;
  try {
    const text = await req.text();
    if (text.length > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 });
    }
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const event = parseRailwayDeployEvent(payload);
  const decision = shouldTriggerVerification(event, {
    webServiceName: env.webServiceName,
    environmentName: env.environmentName,
  });

  if (!decision.trigger) {
    // Acknowledge (200) so Railway does not retry a payload we intentionally skip.
    return NextResponse.json(
      { ok: true, action: 'ignored', reason: decision.reason, status: event?.status ?? null, service: event?.serviceName ?? null },
      { status: 200 },
    );
  }

  if (!env.githubToken) {
    return NextResponse.json({ ok: false, error: 'GITHUB_DISPATCH_TOKEN not configured' }, { status: 500 });
  }

  const clientPayload = sanitizeClientPayload(event);
  const dispatch = deps.dispatch ?? dispatchReleaseVerify;
  const result = await dispatch({ token: env.githubToken, repo: env.repo, clientPayload }, deps.fetchImpl);

  if (!result.ok) {
    // Also visible in the Railway service logs, not just the webhook-delivery
    // response Railway records — the failure must be findable from either side.
    console.error('[release-monitor] github dispatch FAILED:', result.detail);
    return NextResponse.json({ ok: false, action: 'dispatch_failed', error: result.detail }, { status: 502 });
  }

  console.log('[release-monitor] release-verify dispatched', {
    commit: clientPayload.commit,
    deploymentId: clientPayload.deploymentId,
  });
  return NextResponse.json(
    { ok: true, action: 'dispatched', commit: clientPayload.commit, deploymentId: clientPayload.deploymentId },
    { status: 202 },
  );
}

/** Test-only shim — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(req: Request, deps: WebhookDeps): Promise<NextResponse> {
  return handleWebhook(req, deps);
}
