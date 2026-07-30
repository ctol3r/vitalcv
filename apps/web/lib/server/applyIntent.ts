import 'server-only';

import { auth } from '@clerk/nextjs/server';

import type { ApplyIntentView } from '@/lib/apply-intent/types';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export type ApplyIntentLoadResult =
  | { status: 'ok'; data: ApplyIntentView; authenticated: boolean }
  | { status: 'not_found' }
  | { status: 'unavailable'; message: string };

export async function loadApplyIntent(requestUri: string): Promise<ApplyIntentLoadResult> {
  const session = await auth();
  const headers = session.userId
    ? await buildMarketplaceHeaders(session)
    : new Headers({ Accept: 'application/json' });

  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/apply/intents/${encodeURIComponent(requestUri)}`,
      {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) {
      return { status: 'unavailable', message: 'This application request is temporarily unavailable.' };
    }
    return {
      status: 'ok',
      data: await response.json() as ApplyIntentView,
      authenticated: Boolean(session.userId),
    };
  } catch {
    return { status: 'unavailable', message: 'This application request is temporarily unavailable.' };
  }
}
