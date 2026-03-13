import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await context.params;
  const res = await fetch(`${B}/api/velocity/${organizationId}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-clerk-user-id': session.userId,
    },
  });
  return NextResponse.json(await res.json().catch(() => ({})), {
    status: res.status,
  });
}
