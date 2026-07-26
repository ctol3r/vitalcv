import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const NPI_RE = /^\d{10}$/;

type EmployerSetupPayload = {
  name?: string;
  npi?: string;
  facilityType?: string;
  specialties?: string[];
  statesCovered?: string[];
  tagline?: string;
  description?: string;
  website?: string;
  hiringTypes?: string[];
  requirements?: unknown[];
  pilotMode?: boolean;
  organizationAcceptanceRules?: Record<string, unknown>;
  trustAcceptanceContracts?: Record<string, unknown>;
  automationRules?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => null) as EmployerSetupPayload | null;
  if (!payload?.name?.trim()) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
  }

  const nextPayload: EmployerSetupPayload = {
    ...payload,
    name: payload.name.trim(),
  };
  if (payload.npi !== undefined) {
    if (typeof payload.npi !== 'string') {
      return NextResponse.json({ error: 'Organization NPI must be a string.' }, { status: 400 });
    }

    const trimmedNpi = payload.npi.trim();
    if (trimmedNpi.length === 0) {
      delete nextPayload.npi;
    } else {
      if (!NPI_RE.test(trimmedNpi)) {
        return NextResponse.json({ error: 'Organization NPI must be exactly 10 digits.' }, { status: 400 });
      }
      nextPayload.npi = trimmedNpi;
    }
  }

  const res = await fetch(`${B}/api/employer/setup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await buildIdentityHeaders({ userId: session.userId })),
    },
    body: JSON.stringify(nextPayload),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
