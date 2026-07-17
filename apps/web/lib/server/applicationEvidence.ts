import 'server-only';

import { auth } from '@clerk/nextjs/server';
import type { ApplicationEvidenceLoadResult, ApplicationEvidenceViewData } from '@/lib/applications/evidenceView';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { buildMarketplaceHeaders, MARKETPLACE_BACKEND } from '@/lib/server/marketplace-proxy';

export async function loadApplicationEvidenceView(
  applicationId: string,
): Promise<ApplicationEvidenceLoadResult> {
  const session = await auth();
  if (!session.userId) return { status: 'unauthorized' };

  const headers = buildMarketplaceHeaders(session);
  await applyIdentityHeaders(headers, { userId: session.userId });

  try {
    const response = await fetch(
      `${MARKETPLACE_BACKEND}/api/applications/${encodeURIComponent(applicationId)}/packet?includeCurrent=true`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) },
    );
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) {
      return { status: 'error', message: 'Application evidence is temporarily unavailable.' };
    }
    return { status: 'ok', data: await response.json() as ApplicationEvidenceViewData };
  } catch {
    return { status: 'error', message: 'Application evidence is temporarily unavailable.' };
  }
}
