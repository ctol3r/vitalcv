/**
 * VitalCV Webhook Receiver
 *
 * Receives credential events from VitalCV and verifies the HMAC-SHA256 signature.
 * Events include: credential.issued, credential.revoked, trust.updated, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
// In a real project: import { verifyWebhookSignature } from '@vitalcv/verifier-sdk';
// For this example, we inline the verification logic:
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expected = `sha256=${expectedSig}`;
  try {
    return timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Webhook event types ────────────────────────────────────────────────

interface WebhookEvent {
  type: string;
  data: {
    npi?: string;
    credentialId?: string;
    status?: string;
    issuer?: string;
    timestamp?: string;
  };
  traceId: string;
}

// ── In-memory event log (replace with your database) ───────────────────

const eventLog: WebhookEvent[] = [];

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-vitalcv-signature');
  const secret = process.env.VITALCV_WEBHOOK_SECRET ?? '';

  // 1. Verify signature
  const valid = verifyWebhookSignature(rawBody, signature, secret);
  if (!valid) {
    console.warn('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse event
  const event = JSON.parse(rawBody) as WebhookEvent;
  console.log(`[VitalCV Webhook] ${event.type}:`, event.data);

  // 3. Process event
  eventLog.push(event);

  switch (event.type) {
    case 'credential.issued':
      // TODO: Update candidate record with new credential
      console.log(`Credential issued for NPI ${event.data.npi}`);
      break;

    case 'credential.revoked':
      // TODO: Flag candidate for review
      console.warn(`Credential REVOKED for NPI ${event.data.npi}`);
      break;

    case 'trust.updated':
      // TODO: Re-evaluate candidate eligibility
      console.log(`Trust updated for NPI ${event.data.npi}`);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true, traceId: event.traceId });
}

export async function GET() {
  return NextResponse.json({
    events: eventLog.slice(-20),
    total: eventLog.length,
  });
}
