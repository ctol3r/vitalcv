import 'server-only';

import { auth } from '@clerk/nextjs/server';
import type { EmployerWorkflowApplication } from '@/lib/employer-workflow';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export type EmployerWorkflowLoadResult =
  | { status: 'ok'; data: EmployerWorkflowApplication }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * Reads one application through the existing employer workflow service. The
 * backend resolves organization membership from the authenticated actor; this
 * helper never accepts an organization id from the route or the browser.
 */
export async function loadEmployerWorkflowApplication(
  applicationId: string,
): Promise<EmployerWorkflowLoadResult> {
  const session = await auth();
  if (!session.userId) return { status: 'unauthorized' };

  const headers = await buildMarketplaceHeaders(session);

  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(applicationId)}/workflow`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) },
    );
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'error', message: 'Application workflow is temporarily unavailable.' };
    return { status: 'ok', data: await response.json() as EmployerWorkflowApplication };
  } catch {
    return { status: 'error', message: 'Application workflow is temporarily unavailable.' };
  }
}
