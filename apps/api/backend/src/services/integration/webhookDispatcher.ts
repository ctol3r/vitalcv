/**
 * webhookDispatcher.ts — enterprise revocation/lifecycle outbound webhooks.
 *
 * Delivers credential-lifecycle events (revocation, expiry, verification
 * invalidation) to a recipient employer's REGISTERED webhook endpoint. Reached
 * from the revocation outbox worker (workers/revocationOutboxWorker.ts).
 *
 * Security posture (mirrors the apply-share hardening in
 * services/distribution/applyShareService.ts):
 *   - The dispatch target is ONLY ever a server-registered, active
 *     EmployerWebhookConfig that has a configured per-org secret. A missing
 *     config, an inactive one, or one without a secret resolves to null and
 *     NOTHING is sent — fail closed, never sign with a shared default constant.
 *   - Every outbound fetch passes the shared SSRF egress guard (https-only,
 *     default-port-only, no private/loopback/link-local/ULA/metadata/mapped-IPv6
 *     target) and dispatches with `redirect: 'manual'`, so a 3xx to a new host
 *     is treated as a non-delivery and never followed.
 *
 * History (the defect this file carried): the resolver query selected
 * `signingSecret`/`active` — columns that do not exist on the model, which is
 * `secret`/`isActive`. A `@ts-nocheck` at the top hid the type error, and at
 * runtime `findUnique` threw on the unknown fields, so the entire enterprise
 * revocation webhook path was dead. `@ts-nocheck` is removed and the query now
 * reads the real columns via `findFirst` (employerId is not unique).
 */

import { createHmac, randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  assertEgressAllowed,
  EgressBlockedError,
  type EgressResolver,
} from '../distribution/egressGuard';

const FETCH_TIMEOUT = 8_000;

// EmployerWebhookConfig.employerId is a Postgres uuid column; a non-uuid
// employer id can never match a row, so skip the query rather than let Prisma
// throw on the cast (and fail closed on anything malformed).
const EMPLOYER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EnterpriseWebhookEvent =
  | 'credential.revoked'
  | 'credential.expired'
  | 'verification.invalidated';

export interface EnterpriseWebhookPayload {
  schema: 'vitalcv.enterprise.v1';
  event: EnterpriseWebhookEvent;
  delivery_id: string;
  issued_at: string;
  credential: {
    artifact_id: string;
    npi_prefix: string;
    source: string;
    changed_at: string;
    reason: string | null;
    lifecycle_state: string;
  };
  cascade: {
    affected: number;
    invalid: number;
    at_risk: number;
    capsule_ids: string[];
  };
  trust_state: {
    previous_band: string | null;
    new_band: string | null;
    snapshot_artifact_id: string | null;
    computed_at: string | null;
  };
  employer: {
    employer_id: string;
    acceptance_id: string;
  };
}

export interface EnterpriseWebhookDispatchTarget {
  employerId: string;
  acceptanceId: string;
  webhookUrl: string;
  signingSecret: string;
}

/** Injectable seams so the dispatch path is testable without net/DNS. */
export interface EnterpriseWebhookDispatchDeps {
  fetchImpl?: typeof fetch;
  resolver?: EgressResolver;
}

function sign(secret: string, timestampMs: number, body: string): string {
  return createHmac('sha256', secret).update(`t=${timestampMs}${body}`).digest('hex');
}

function buildSignatureHeader(secret: string, body: string): string {
  const timestampMs = Date.now();
  return `t=${timestampMs},v1=${sign(secret, timestampMs, body)}`;
}

/**
 * Resolve the server-verified webhook target for a recipient employer.
 *
 * Only a REGISTERED, active EmployerWebhookConfig with a configured per-org
 * secret is a valid target. A missing config, an inactive one, or one without a
 * secret returns null — the caller then fails closed rather than dispatching to
 * an unregistered URL or signing with a shared default.
 */
export async function resolveEnterpriseWebhookTarget(
  employerId: string,
  acceptanceId: string,
): Promise<EnterpriseWebhookDispatchTarget | null> {
  if (!EMPLOYER_UUID_RE.test(employerId)) return null;

  const config = await prisma.employerWebhookConfig
    .findFirst({
      where: { employerId, isActive: true },
      select: { employerId: true, webhookUrl: true, secret: true, isActive: true },
    })
    .catch(() => null);

  if (!config || !config.isActive) return null;
  // Fail closed: a registered config without a URL or a per-org secret is not a
  // valid target — we never sign with a shared default constant.
  if (!config.webhookUrl || !config.secret) return null;

  return {
    employerId: config.employerId,
    acceptanceId,
    webhookUrl: config.webhookUrl,
    signingSecret: config.secret,
  };
}

export async function resolveEnterpriseWebhookTargets(
  npi: string,
): Promise<EnterpriseWebhookDispatchTarget[]> {
  const acceptances = await prisma.acceptance.findMany({
    where: { subjectId: npi },
    select: {
      acceptanceId: true,
      employerId: true,
    },
  });

  if (acceptances.length === 0) {
    return [];
  }

  const deduped = new Map<string, string>();
  for (const acceptance of acceptances) {
    if (!deduped.has(acceptance.employerId)) {
      deduped.set(acceptance.employerId, acceptance.acceptanceId);
    }
  }

  const targets = await Promise.all(
    Array.from(deduped.entries()).map(([employerId, acceptanceId]) =>
      resolveEnterpriseWebhookTarget(employerId, acceptanceId),
    ),
  );

  return targets.filter(
    (target): target is EnterpriseWebhookDispatchTarget => target !== null,
  );
}

export async function dispatchEnterpriseWebhook(
  target: EnterpriseWebhookDispatchTarget,
  payload: EnterpriseWebhookPayload,
  deps: EnterpriseWebhookDispatchDeps = {},
): Promise<void> {
  // Fail closed: never sign with an empty/default secret. resolveEnterprise-
  // WebhookTarget already guarantees a per-org secret, but a caller could pass
  // a target directly, so this boundary refuses to dispatch without one.
  if (!target.signingSecret) {
    throw new Error('Enterprise webhook target has no signing secret; refusing to dispatch.');
  }

  // Egress guard (SSRF): even a registered URL must be a public https endpoint
  // that does not resolve to a private/loopback/link-local/metadata address.
  let allowed: { url: URL; addresses: string[] };
  try {
    allowed = await assertEgressAllowed(target.webhookUrl, { resolver: deps.resolver });
  } catch (err) {
    const reason = err instanceof EgressBlockedError ? err.reason : 'egress_blocked';
    log('warn', 'enterprise_webhook_egress_blocked', {
      deliveryId: payload.delivery_id,
      employerId: target.employerId,
      reason,
    });
    // Re-throw so the outbox worker records the failure and does not deliver.
    throw err instanceof Error ? err : new Error(`egress_blocked:${reason}`);
  }

  const body = JSON.stringify(payload);
  const signature = buildSignatureHeader(target.signingSecret, body);
  const fetchImpl = deps.fetchImpl ?? fetch;

  const response = await fetchImpl(allowed.url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VitalCV-Signature': signature,
      'X-VitalCV-Event': payload.event,
      'X-VitalCV-Delivery': payload.delivery_id,
      'User-Agent': 'VitalCV-WebhookDispatcher/2.0',
    },
    body,
    // Never follow a redirect to a new host — we validated the initial target only.
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  // `redirect: 'manual'` surfaces a 3xx (or an opaqueredirect) instead of
  // following it. Treat any redirect as a non-delivery.
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Redirect blocked: HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  log('info', 'enterprise_webhook_dispatched', {
    deliveryId: payload.delivery_id,
    employerId: target.employerId,
    artifactId: payload.credential.artifact_id,
    event: payload.event,
  });
}

export async function dispatchEnterpriseWebhooks(
  npi: string,
  artifactId: string,
  source: string,
  changedAt: string,
  reason: string,
  deps: EnterpriseWebhookDispatchDeps = {},
): Promise<void> {
  const targets = await resolveEnterpriseWebhookTargets(npi);

  if (targets.length === 0) {
    log('info', 'enterprise_webhook_dispatch_no_targets', {
      npi,
      artifactId,
    });
    return;
  }

  await Promise.allSettled(
    targets.map((target) =>
      dispatchEnterpriseWebhook(
        target,
        {
          schema: 'vitalcv.enterprise.v1',
          event: 'credential.revoked',
          delivery_id: randomUUID(),
          issued_at: new Date().toISOString(),
          credential: {
            artifact_id: artifactId,
            npi_prefix: `${npi.slice(0, 4)}······`,
            source,
            changed_at: changedAt,
            reason,
            lifecycle_state: 'revoked',
          },
          cascade: {
            affected: 0,
            invalid: 0,
            at_risk: 0,
            capsule_ids: [],
          },
          trust_state: {
            previous_band: null,
            new_band: null,
            snapshot_artifact_id: null,
            computed_at: null,
          },
          employer: {
            employer_id: target.employerId,
            acceptance_id: target.acceptanceId,
          },
        },
        deps,
      ),
    ),
  );
}
