// @ts-nocheck
import { createHmac, randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

const FETCH_TIMEOUT = 8_000;

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

function sign(secret: string, timestampMs: number, body: string): string {
  return createHmac('sha256', secret).update(`t=${timestampMs}${body}`).digest('hex');
}

function buildSignatureHeader(secret: string, body: string): string {
  const timestampMs = Date.now();
  return `t=${timestampMs},v1=${sign(secret, timestampMs, body)}`;
}

export async function resolveEnterpriseWebhookTarget(
  employerId: string,
  acceptanceId: string,
): Promise<EnterpriseWebhookDispatchTarget | null> {
  const config = await prisma.employerWebhookConfig.findUnique({
    where: { employerId },
    select: {
      employerId: true,
      webhookUrl: true,
      signingSecret: true,
      active: true,
    },
  });

  if (!config?.active) {
    return null;
  }

  return {
    employerId: config.employerId,
    acceptanceId,
    webhookUrl: config.webhookUrl,
    signingSecret: config.signingSecret,
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
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = buildSignatureHeader(target.signingSecret, body);

  const response = await fetch(target.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VitalCV-Signature': signature,
      'X-VitalCV-Event': payload.event,
      'X-VitalCV-Delivery': payload.delivery_id,
      'User-Agent': 'VitalCV-WebhookDispatcher/2.0',
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

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
      dispatchEnterpriseWebhook(target, {
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
      }),
    ),
  );
}
