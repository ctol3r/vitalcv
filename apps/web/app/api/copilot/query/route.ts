import { type NextRequest, NextResponse } from 'next/server';
import { queryCopilot } from '../_shared';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  return NextResponse.json(await queryCopilot(body, req.nextUrl.pathname));
}
