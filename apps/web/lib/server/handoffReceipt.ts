import 'server-only';

import { auth } from '@clerk/nextjs/server';

import type { EmployerApplicationHandoff } from '@/lib/apply-intent/types';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export type EmployerHandoffLoadResult =
  | { status: 'ok'; data: EmployerApplicationHandoff }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function loadEmployerHandoff(
  applicationId: string,
): Promise<EmployerHandoffLoadResult> {
  const session = await auth();
  if (!session.userId) return { status: 'unauthorized' };
  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(applicationId)}/handoff`,
      {
        headers: await buildMarketplaceHeaders(session),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'error', message: 'Handoff receipts are temporarily unavailable.' };
    return { status: 'ok', data: await response.json() as EmployerApplicationHandoff };
  } catch {
    return { status: 'error', message: 'Handoff receipts are temporarily unavailable.' };
  }
}
