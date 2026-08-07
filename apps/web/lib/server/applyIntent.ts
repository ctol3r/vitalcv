import 'server-only';

import { auth } from '@clerk/nextjs/server';

import type { ApplyIntentView } from '@/lib/apply-intent/types';
import { MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export type ApplyIntentLoadResult =
  | { status: 'ok'; data: ApplyIntentView; authenticated: boolean }
  | { status: 'not_found' }
  | { status: 'unavailable'; message: string };

/**
 * Loads only the public employer/opportunity context. Authenticated clinician
 * evidence is fetched by the client after sign-in so an onboarding gap can never
 * hide the original request or turn the public link into a private-data response.
 */
export async function loadApplyIntent(requestUri: string): Promise<ApplyIntentLoadResult> {
  const session = await auth();
  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/apply/intents/${encodeURIComponent(requestUri)}`,
      {
        headers: { Accept: 'application/json' },
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
