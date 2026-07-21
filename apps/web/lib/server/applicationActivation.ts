import 'server-only';

import { auth } from '@clerk/nextjs/server';
import type { ActivationLoadResult, ClinicianActivationView } from '@/lib/applications/activationView';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

/**
 * Load the owning clinician's activation "path to start" for one application
 * (ACT-7.1 read). Mirrors loadApplicationEvidenceView exactly: it forwards the
 * verified Clerk identity and maps the backend's uniform 404 through unchanged,
 * so a non-owned id is indistinguishable from an unknown one. No caller-supplied
 * identity is ever trusted; ownership is enforced by the backend.
 */
export async function loadApplicationActivationView(
  applicationId: string,
): Promise<ActivationLoadResult> {
  const session = await auth();
  if (!session.userId) return { status: 'unauthorized' };

  const headers = await buildMarketplaceHeaders(session);
  await applyIdentityHeaders(headers, { userId: session.userId });

  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(applicationId)}/activation`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) },
    );
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) {
      return { status: 'error', message: 'Your path to start is temporarily unavailable.' };
    }
    return { status: 'ok', data: await response.json() as ClinicianActivationView };
  } catch {
    return { status: 'error', message: 'Your path to start is temporarily unavailable.' };
  }
}
