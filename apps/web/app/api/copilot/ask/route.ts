import { type NextRequest, NextResponse } from 'next/server';
import {
  buildCopilotAskFallback,
  formatCopilotAskResponse,
  queryCopilot,
} from '../_shared';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await req.text();
    const payload = await queryCopilot(body, req.nextUrl.pathname);
    return NextResponse.json(formatCopilotAskResponse(payload, Date.now() - startedAt));
  } catch {
    return NextResponse.json(buildCopilotAskFallback());
  }
}
