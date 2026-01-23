import { NextResponse, type NextRequest } from 'next/server';
import { createShareToken } from '@domain/qia';
import type { GoldenPathScenario } from '@/lib/golden-path';
import { createShareRecord } from '@/app/api/_golden-path/shareStore';

const DEFAULT_SCOPE = ['credential:verify', 'readiness:crs'] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const holderId = typeof body?.holderId === 'string' ? body.holderId : '';
    const scenario: GoldenPathScenario = body?.scenario === 'not-ready' ? 'not-ready' : 'ready';
    const scopeInput = body?.scope as
      | string[]
      | { scope?: string[]; purpose?: string; expiry?: string }
      | undefined;
    const now = new Date();

    if (!holderId) {
      return NextResponse.json({ error: 'holderId is required' }, { status: 400 });
    }
    const scopeList = Array.isArray(scopeInput)
      ? scopeInput.filter((entry): entry is string => typeof entry === 'string')
      : Array.isArray(scopeInput?.scope)
        ? scopeInput.scope.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const purpose =
      typeof body?.purpose === 'string'
        ? body.purpose
        : typeof scopeInput?.purpose === 'string'
          ? scopeInput.purpose
          : '';

    let ttlSeconds =
      typeof body?.ttlSeconds === 'number'
        ? body.ttlSeconds
        : typeof body?.ttl_seconds === 'number'
          ? body.ttl_seconds
          : undefined;

    if (ttlSeconds === undefined && typeof scopeInput?.expiry === 'string') {
      const expiry = new Date(scopeInput.expiry);
      if (Number.isNaN(expiry.getTime())) {
        return NextResponse.json({ error: 'scope.expiry must be a valid ISO timestamp' }, { status: 400 });
      }
      const diffSeconds = Math.floor((expiry.getTime() - now.getTime()) / 1000);
      if (diffSeconds <= 0) {
        return NextResponse.json({ error: 'scope.expiry must be in the future' }, { status: 400 });
      }
      ttlSeconds = diffSeconds;
    }

    const scope = scopeList.length > 0 ? scopeList : purpose ? [...DEFAULT_SCOPE] : [];

    let shareToken: ReturnType<typeof createShareToken>;
    try {
      shareToken = createShareToken({
        holder_id: holderId,
        scope,
        purpose,
        ttl_seconds: ttlSeconds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid share input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    createShareRecord({ token: shareToken, scenario });

    const origin = request.nextUrl.origin;
    const shareUrl = `${origin}/verify/${encodeURIComponent(shareToken.token_id)}`;

    return NextResponse.json({ shareUrl, token: shareToken.token_id });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Unable to create share package' }, { status: 500 });
  }
}
