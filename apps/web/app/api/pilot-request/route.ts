import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/pilot-request
 *
 * Stub — accepts pilot request form data.
 * TODO: persist to database, send notification email, write AuditEvent.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Basic validation
  const { organization, name, email } = body as Record<string, unknown>;
  if (!organization || !name || !email) {
    return NextResponse.json(
      { ok: false, message: 'Organization, name, and email are required.' },
      { status: 400 },
    );
  }

  // TODO: write AuditEvent, persist to DB, send notification

  return NextResponse.json({
    ok: true,
    message: 'Pilot request received. We will reach out within 2 business days.',
  });
}
