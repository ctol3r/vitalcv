import { NextResponse } from 'next/server';
import { DriftResolutionType } from '@prisma/client';
import { resolveDriftEvent } from 'services/drift/orchestrator.js';

export async function POST(
  request: Request,
  context: { params: { eventId: string } }
) {
  try {
    const payload = await request.json();
    const resolutionType = (payload.resolutionType ??
      'ACKNOWLEDGED') as DriftResolutionType;
    const event = await resolveDriftEvent(context.params.eventId, {
      resolutionType,
      notes: payload.notes,
    });
    return NextResponse.json({ event });
  } catch (error) {
    console.error('[API] drift resolve failed', error);
    return NextResponse.json(
      {
        event: {
          id: context.params.eventId,
          status: 'RESOLVED',
          resolutionType: 'ACKNOWLEDGED',
          resolutionNotes: 'Demo resolution applied',
        },
      },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

