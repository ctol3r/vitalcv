import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { loadClinicianMobileData } from '@/lib/mobile/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await loadClinicianMobileData(session);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Live feed synchronization interrupted',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
