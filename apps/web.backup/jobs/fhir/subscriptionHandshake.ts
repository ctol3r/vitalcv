import { PrismaClient, FHIRSubscriptionStatus } from '@prisma/client';
import { createLogger, serializeError } from '@chai-vc/logging-core';

const prisma = new PrismaClient();
const log = createLogger({ service: 'fhir-subscription-handshake' });

interface HandshakeJobOptions {
  limit?: number;
  fetchImpl?: typeof fetch;
}

interface HandshakeSummary {
  checked: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

function validateCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function sendProbe(
  url: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<Response> {
  return fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fhir-event': 'subscription.handshake',
    },
    body: JSON.stringify(body),
  });
}

export async function runSubscriptionHandshake(
  options: HandshakeJobOptions = {}
): Promise<HandshakeSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 100;

  const subscriptions = await prisma.fHIRSubscription.findMany({
    where: {
      status: {
        in: [FHIRSubscriptionStatus.ACTIVE, FHIRSubscriptionStatus.PAUSED, FHIRSubscriptionStatus.FAILED],
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
    take: limit,
  });

  const summary: HandshakeSummary = {
    checked: subscriptions.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const subscription of subscriptions) {
    if (!validateCallbackUrl(subscription.callbackUrl)) {
      summary.failed += 1;
      await prisma.fHIRSubscription.update({
        where: { id: subscription.id },
        data: { status: FHIRSubscriptionStatus.FAILED },
      });
      log.warn('Invalid callback URL for FHIR subscription', {
        subscriptionId: subscription.id,
        callbackUrl: subscription.callbackUrl,
      });
      continue;
    }

    const handshakePayload = {
      resourceType: 'Bundle',
      type: 'handshake',
      timestamp: new Date().toISOString(),
      subscription: {
        id: subscription.id,
        resourceType: subscription.resourceType,
        criteria: subscription.criteria,
      },
    };

    try {
      const response = await sendProbe(subscription.callbackUrl, handshakePayload, fetchImpl);
      if (!response.ok) {
        throw new Error(`Handshake responded with ${response.status}`);
      }

      await prisma.fHIRSubscription.update({
        where: { id: subscription.id },
        data: {
          status: FHIRSubscriptionStatus.ACTIVE,
          lastHandshakeAt: new Date(),
        },
      });
      summary.succeeded += 1;
    } catch (error) {
      summary.failed += 1;
      await prisma.fHIRSubscription.update({
        where: { id: subscription.id },
        data: {
          status: FHIRSubscriptionStatus.FAILED,
        },
      });
      log.error('FHIR subscription handshake failed', {
        subscriptionId: subscription.id,
        error: serializeError(error),
      });
    }
  }

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSubscriptionHandshake()
    .then((summary) => {
      log.info('Completed FHIR subscription handshake sweep', summary);
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      log.error('Fatal error running FHIR subscription handshake job', {
        error: serializeError(error),
      });
      process.exit(1);
    });
}

