import type { ReadinessStatus } from '@/lib/trust/passport-contract';

export function isAcceptBlockedDecisionPosture(
  status: ReadinessStatus | null | undefined,
): boolean {
  return status === 'BLOCKED';
}
