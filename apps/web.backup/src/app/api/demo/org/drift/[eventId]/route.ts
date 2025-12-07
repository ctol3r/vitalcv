import { NextResponse } from 'next/server';
import { getDriftEvent } from 'services/drift/orchestrator.js';

export async function GET(
  _request: Request,
  context: { params: { eventId: string } }
) {
  try {
    const event = await getDriftEvent(context.params.eventId);
    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error) {
    console.warn('[API] drift detail using mock data', error);
    return NextResponse.json(
      { event: buildMockEvent(context.params.eventId) },
      { headers: { 'x-demo-data': 'true' } }
    );
  }
}

function buildMockEvent(eventId: string) {
  const now = new Date();
  return {
    id: eventId,
    summary: 'Privilege set expired without renewal',
    severity: 'CRITICAL',
    status: 'OPEN',
    category: 'PRIVILEGE',
    recommendation: 'Escalate to medical staff leadership',
    metadata: {
      privilegeGrantedId: 'mock-priv',
      mitigation: {
        type: 'privilege',
        actions: ['privilege_hold'],
      },
    },
    payload: {
      renewalDue: now.toISOString(),
    },
    lastDetectedAt: now.toISOString(),
    triggeredAt: now.toISOString(),
  };
}

