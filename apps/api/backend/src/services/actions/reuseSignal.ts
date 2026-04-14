/**
 * reuseSignal.ts — Wave 13 trust reuse engine.
 *
 * Purely informational aggregation of prior-employer actions for an NPI.
 * Combines:
 *   - Acceptance rows (subjectId = npi) → accepted_count
 *   - ActionLog rows (npi) → flagged_count, request_data_count
 *
 * IMPORTANT: This signal MUST NOT feed into buildDecision, readiness, or
 * confidence calculations. It is contextual only.
 */

import prisma from '../../graphql/prisma_client';

export type ReuseSignalAction = 'accept' | 'request_data' | 'flag';

export interface ReuseSignal {
  accepted_count: number;
  flagged_count: number;
  request_data_count: number;
  last_action: ReuseSignalAction | null;
  last_action_at: string | null;
}

const EMPTY_SIGNAL: ReuseSignal = {
  accepted_count: 0,
  flagged_count: 0,
  request_data_count: 0,
  last_action: null,
  last_action_at: null,
};

export async function computeReuseSignal(npi: string): Promise<ReuseSignal> {
  const [acceptances, actionEntries] = await Promise.all([
    prisma.acceptance.findMany({
      where: { subjectId: npi },
      select: { acceptedAt: true },
      orderBy: { acceptedAt: 'desc' },
    }),
    prisma.actionLog.findMany({
      where: { npi },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (acceptances.length === 0 && actionEntries.length === 0) {
    return { ...EMPTY_SIGNAL };
  }

  let flagged_count = 0;
  let request_data_count = 0;
  for (const entry of actionEntries) {
    if (entry.action === 'flag') flagged_count += 1;
    else if (entry.action === 'request_data') request_data_count += 1;
  }

  const latestAccept = acceptances[0]?.acceptedAt ?? null;
  const latestLogged = actionEntries[0] ?? null;

  let last_action: ReuseSignalAction | null = null;
  let last_action_at: string | null = null;

  if (latestAccept && (!latestLogged || latestAccept.getTime() >= latestLogged.createdAt.getTime())) {
    last_action = 'accept';
    last_action_at = latestAccept.toISOString();
  } else if (latestLogged) {
    const action = latestLogged.action;
    if (action === 'flag' || action === 'request_data') {
      last_action = action;
      last_action_at = latestLogged.createdAt.toISOString();
    }
  }

  return {
    accepted_count: acceptances.length,
    flagged_count,
    request_data_count,
    last_action,
    last_action_at,
  };
}
