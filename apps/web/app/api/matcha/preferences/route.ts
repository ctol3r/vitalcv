/**
 * /api/matcha/preferences — durable MATCHA career preferences (Career DNA).
 *
 * Auth-scoped to the authenticated Clerk user (identity from auth(), NOT a
 * caller-supplied header), so a clinician's preferences follow the provider
 * across devices instead of living only in the browser's localStorage. Reads
 * and writes the shared `MatchaPreference` table via the web Prisma client.
 *
 * These are self-stated, editable preferences ONLY — never credentials or
 * evidence. Writes are sanitized to the known preference fields before persist.
 *
 * Deploy-order safe: if the table does not exist yet (migration not deployed)
 * or the DB hiccups, both verbs degrade to an empty/no-op response so the
 * client silently falls back to its local cache — never a 500 in the signed-in
 * experience.
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/db';
import { sanitizeStoredPreferences } from '@/lib/matcha/preferences';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    const row = await prisma.matchaPreference.findUnique({ where: { clerkUserId: userId } });
    return NextResponse.json({
      preferences: row ? sanitizeStoredPreferences(row.data) : {},
      updatedAt: row?.updatedAt.toISOString() ?? null,
    });
  } catch (err) {
    console.error('[matcha/preferences GET]', err);
    // Degrade rather than 500, but say so. An empty 200 is indistinguishable from an
    // account that genuinely has no preferences saved, and the client would render the
    // browser's local copy as though it were the account's own.
    return NextResponse.json({ preferences: {}, updatedAt: null, degraded: true });
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Accept either { preferences: {...} } or a bare preferences object.
  const raw =
    body && typeof body === 'object' && !Array.isArray(body) && 'preferences' in (body as object)
      ? (body as { preferences: unknown }).preferences
      : body;
  const data = sanitizeStoredPreferences(raw);

  try {
    const row = await prisma.matchaPreference.upsert({
      where: { clerkUserId: userId },
      create: { clerkUserId: userId, data: data as Prisma.InputJsonValue },
      update: { data: data as Prisma.InputJsonValue },
    });
    return NextResponse.json({
      ok: true,
      updatedAt: row.updatedAt.toISOString(),
      fields: Object.keys(data).length,
    });
  } catch (err) {
    console.error('[matcha/preferences PUT]', err);
    // Never break the client, but never imply the write landed either: `ok:false` is
    // the signal that this answer exists only in the caller's browser. Clients must
    // treat it as an unsaved write, not as a successful one.
    return NextResponse.json({ ok: false, degraded: true }, { status: 200 });
  }
}
