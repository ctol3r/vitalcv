import 'server-only';

import { auth } from '@clerk/nextjs/server';
import type { HireToStartCase, HireToStartLoadResult } from '@/lib/applications/hireToStart';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

/**
 * Loads the joined case for either its owning clinician or an authorized
 * employer member. Tenant and packet authorization remain backend decisions.
 */
export async function loadHireToStartCase(applicationId: string): Promise<HireToStartLoadResult> {
  const session = await auth();
  if (!session.userId) return { status: 'unauthorized' };

  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(applicationId)}/hire-to-start`,
      {
        headers: await buildMarketplaceHeaders(session),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'error', message: 'The hire-to-start case is temporarily unavailable.' };
    return { status: 'ok', data: await response.json() as HireToStartCase };
  } catch {
    return { status: 'error', message: 'The hire-to-start case is temporarily unavailable.' };
  }
}
