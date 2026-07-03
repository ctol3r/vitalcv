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

  let payload: unknown = null;
  try {
    const text = await req.text();
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

  const dispatch = deps.dispatch ?? dispatchReleaseVerify;
  const result = await dispatch(
    {
      token: env.githubToken,
      repo: env.repo,
      clientPayload: {
        source: 'railway-webhook',
        deploymentId: event?.deploymentId ?? null,
        commit: event?.commit ?? null,
        service: event?.serviceName ?? null,
        environment: event?.environmentName ?? null,
      },
    },
    deps.fetchImpl,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, action: 'dispatch_failed', error: result.detail }, { status: 502 });
  }

  return NextResponse.json(
    { ok: true, action: 'dispatched', commit: event?.commit ?? null, deploymentId: event?.deploymentId ?? null },
    { status: 202 },
  );
}

/** Test-only shim — invoked directly by route tests with DI'd deps. */
export async function __handleForTests(req: Request, deps: WebhookDeps): Promise<NextResponse> {
  return handleWebhook(req, deps);
}
