import 'server-only';

import { getBackendBase } from '@/lib/api';
import type { PilotProofSummary } from '@/lib/proof/types';
import { getMonitoringSecret } from '@/lib/server/pilot-ops';

function withMonitoringSecret(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  const secret = getMonitoringSecret();
  if (secret) {
    next.set('x-monitoring-secret', secret);
  }
  return next;
}

export async function fetchPilotProofSnapshot(
  lookbackDays?: number,
): Promise<PilotProofSummary | null> {
  const secret = getMonitoringSecret();
  if (!secret) {
    return null;
  }

  try {
    const url = new URL('/api/internal/pilot-proof', getBackendBase());
    if (typeof lookbackDays === 'number' && Number.isFinite(lookbackDays) && lookbackDays > 0) {
      url.searchParams.set('lookbackDays', String(Math.round(lookbackDays)));
    }

    const response = await fetch(url, {
      headers: withMonitoringSecret(),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PilotProofSummary;
  } catch {
    return null;
  }
}
