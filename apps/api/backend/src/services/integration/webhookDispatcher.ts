/**
 * webhookDispatcher.ts — Wave 40: Continuous Trust & Revocation Engine
 *
 * Enterprise Webhook Dispatcher.
 *
 * When a credential is revoked by the continuous monitoring worker or the
 * issuer API, this service:
 *   1. Resolves every active Acceptance for the affected NPI.
 *   2. Looks up EmployerWebhookConfig for each unique employerId.
 *   3. Dispatches a signed `event: "credential.revoked"` JSON payload to
 *      each registered webhook URL.
 *   4. Retries failed deliveries with exponential backoff (max 3 attempts,
 *      base delay 1 s, factor 2 → 1 s / 2 s / 4 s).
 *
 * SECURITY
 * ────────
 * • Each payload is signed with HMAC-SHA256 using a per-employer secret
 *   stored in `EmployerWebhookConfig.signingSecret`.
 * • The `X-VitalCV-Signature` header carries: `t=<unix_ms>,v1=<hex_sig>`.
 *   Receivers verify by recomputing HMAC-SHA256(secret, `t=...`+body) and
 *   checking against `v1`.
 * • NPI is truncated to 4-digit prefix in the payload — no raw PII leaves.
 * • Each dispatch is logged with outcome and retry count.
 *
 * DURABILITY
 * ──────────
 * For a production-grade system, failed webhooks after all retries should be
 * persisted to a `WebhookDeliveryFailure` table for human review or a DLQ.
 * The current implementation logs and drops to keep Wave 40 scope bounded.
 */

import { createHmac, randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 1_000;
const FETCH_TIMEOUT = 8_000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface RevocationWebhookPayload {
  schema:      'vitalcv.enterprise.v1';
  event:       'credential.revoked';
  delivery_id: string;
  issued_at:   string;
  credential: {
    artifact_id:  string;
    npi_prefix:   string; // first 4 digits only
    source:       string;
    revoked_at:   string;
    reason:       string;
  };
  employer: {
    employer_id:   string;
    acceptance_id: string;
  };
}

interface DispatchTarget {
  employerId:    string;
  acceptanceId:  string;
  webhookUrl:    string;
  signingSecret: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sign(secret: string, timestampMs: number, body: string): string {
  const message = `t=${timestampMs}${body}`;
  return createHmac('sha256', secret).update(message).digest('hex');
}

function buildSignatureHeader(secret: string, body: string): string {
  const t   = Date.now();
  const sig = sign(secret, t, body);
  return `t=${t},v1=${sig}`;
}

/**
 * Attempt a single POST delivery. Throws on non-2xx or network error.
 */
async function attemptDelivery(
  url:     string,
  body:    string,
  sigHeader: string,
  deliveryId: string,
): Promise<void> {
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':        'application/json',
      'X-VitalCV-Signature': sigHeader,
      'X-VitalCV-Event':     'credential.revoked',
      'X-VitalCV-Delivery':  deliveryId,
      'User-Agent':          'VitalCV-WebhookDispatcher/1.0',
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
}

/**
 * Dispatch a single webhook with exponential backoff.
 *
 * Retry schedule (if each attempt fails):
 *   Attempt 1: immediate
 *   Attempt 2: +1 s
 *   Attempt 3: +2 s
 *   Attempt 4 (final): +4 s — then give up
 */
async function dispatchWithRetry(
  target:  DispatchTarget,
  payload: RevocationWebhookPayload,
): Promise<void> {
  const body       = JSON.stringify(payload);
  const sigHeader  = buildSignatureHeader(target.signingSecret, body);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await attemptDelivery(target.webhookUrl, body, sigHeader, payload.delivery_id);
      log('info', 'webhook_dispatched', {
        delivery_id:  payload.delivery_id,
        employer_id:  target.employerId,
        artifact_id:  payload.credential.artifact_id,
        attempt,
      });
      return; // ✓ success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log('warn', 'webhook_dispatch_attempt_failed', {
        delivery_id:  payload.delivery_id,
        employer_id:  target.employerId,
        attempt,
        max_attempts: MAX_RETRIES + 1,
        error:        lastError.message,
      });

      if (attempt <= MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  log('error', 'webhook_dispatch_exhausted', {
    delivery_id:   payload.delivery_id,
    employer_id:   target.employerId,
    artifact_id:   payload.credential.artifact_id,
    webhook_url:   target.webhookUrl,
    final_error:   lastError?.message ?? 'unknown',
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Find all employers holding active Acceptances for `npi` and dispatch a
 * signed `credential.revoked` webhook payload to each configured endpoint.
 *
 * @param npi          The NPI of the revoked clinician.
 * @param artifactId   UUID of the revoked VerificationArtifact.
 * @param source       Primary source name (e.g. "NPDB", "CA-BRN").
 * @param revokedAt    ISO timestamp of the revocation.
 * @param reason       Human-readable revocation reason.
 */
export async function dispatchEnterpriseWebhooks(
  npi:        string,
  artifactId: string,
  source:     string,
  revokedAt:  string,
  reason:     string,
): Promise<void> {
  // ── Step 1: Resolve active Acceptances for the clinician ────────────────
  const acceptances = await prisma.acceptance.findMany({
    where:  { subjectId: npi },
    select: { acceptanceId: true, employerId: true },
  });

  if (acceptances.length === 0) {
    log('info', 'webhook_dispatch_no_acceptances', { npi, artifactId });
    return;
  }

  // Deduplicate employer IDs while preserving one acceptanceId per employer
  const byEmployer = new Map<string, string>(); // employerId → acceptanceId
  for (const acc of acceptances) {
    if (!byEmployer.has(acc.employerId)) {
      byEmployer.set(acc.employerId, acc.acceptanceId);
    }
  }

  // ── Step 2: Look up webhook configs for each employer ───────────────────
  const employerIds = Array.from(byEmployer.keys());
  const configs     = await prisma.employerWebhookConfig.findMany({
    where: {
      employerId: { in: employerIds },
      active:     true,
    },
    select: { employerId: true, webhookUrl: true, signingSecret: true },
  });

  if (configs.length === 0) {
    log('info', 'webhook_dispatch_no_configs', { npi, artifactId, employer_count: employerIds.length });
    return;
  }

  // ── Step 3: Dispatch (fire-and-forget, run in parallel) ─────────────────
  const dispatches = configs.map(cfg => {
    const acceptanceId = byEmployer.get(cfg.employerId) ?? 'unknown';
    const deliveryId   = randomUUID();

    const payload: RevocationWebhookPayload = {
      schema:      'vitalcv.enterprise.v1',
      event:       'credential.revoked',
      delivery_id: deliveryId,
      issued_at:   new Date().toISOString(),
      credential: {
        artifact_id: artifactId,
        npi_prefix:  npi.slice(0, 4) + '······',
        source,
        revoked_at:  revokedAt,
        reason,
      },
      employer: {
        employer_id:   cfg.employerId,
        acceptance_id: acceptanceId,
      },
    };

    return dispatchWithRetry(
      { employerId: cfg.employerId, acceptanceId, webhookUrl: cfg.webhookUrl, signingSecret: cfg.signingSecret },
      payload,
    );
  });

  // Run all dispatches in parallel; individual failures are caught inside dispatchWithRetry
  await Promise.allSettled(dispatches);

  log('info', 'webhook_dispatch_complete', {
    npi,
    artifactId,
    employer_count:  configs.length,
  });
}
