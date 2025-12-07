import { NextResponse } from 'next/server';
import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { logCredentialTimelineEvent } from 'services/timeline/logCredentialTimelineEvent';

interface SharePayload {
  clinicianId?: string;
  channel?: string;
  shortLink?: string;
  routingOrg?: string;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as SharePayload;
  const clinicianId = payload.clinicianId ?? 'clinician-demo-001';

  try {
    await logCredentialTimelineEvent({
      clinicianId,
      eventType: CredentialTimelineEventType.PASSPORT_SHARED,
      severity: TimelineEventSeverity.INFO,
      metadata: {
        channel: payload.channel,
        shortLink: payload.shortLink,
        routingOrg: payload.routingOrg,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] passport share logging failed', error);
    return NextResponse.json({ ok: false, fallback: true }, { status: 202, headers: { 'x-demo-data': 'true' } });
  }
}

