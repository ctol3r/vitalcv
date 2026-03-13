/**
 * Wave 246: Apply-with-VitalCV — GET /api/apply/bundle/:bundleId proxy
 */
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> },
) {
  const { bundleId } = await params;
  const res = await fetch(`${B}/api/apply/bundle/${bundleId}`);
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
