import { writeCapsule } from '@/lib/capsules';

export interface ExecutePassportActionInput {
  blocker: string;
  allowedBlockers: readonly string[];
  subjectNpi: string;
  readinessScoreBefore?: number | null;
  fetchImpl?: typeof fetch;
}

export interface PassportActionExecutionResult {
  blocker: string;
  capsuleRecorded: boolean;
  omegaTriggered: boolean;
}

export interface PassportActionReleaseInput {
  resolvingBlocker: string | null;
  baselineReadinessScore?: number;
  currentReadinessScore?: number;
  phase: string;
  isUsable: boolean;
  completedAt?: string | null;
  readyAt?: string | null;
}

function normalizeBlocker(value: string): string {
  return value.trim();
}

function isValidNpi(value: string): boolean {
  return /^\d{10}$/.test(value);
}

async function triggerOmegaRecompute(
  subjectNpi: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl('/api/omega', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        npi: subjectNpi,
        actorType: 'clinician',
      }),
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function executePassportAction(
  input: ExecutePassportActionInput,
): Promise<PassportActionExecutionResult> {
  const blocker = normalizeBlocker(input.blocker);
  const allowedBlockers = input.allowedBlockers
    .map(normalizeBlocker)
    .filter(Boolean);

  if (!blocker || !allowedBlockers.includes(blocker)) {
    throw new Error('Unknown blocker action');
  }

  if (!isValidNpi(input.subjectNpi)) {
    throw new Error('Invalid action subject');
  }

  const capsuleResult = await writeCapsule({
    subjectNpi: input.subjectNpi,
    decisionType: 'DEPLOYMENT',
    triggerEvent: 'start_attestation',
    metadata: {
      source: 'passport.action-panel',
      intent: 'resolve_blocker',
      blocker,
      readinessScoreBefore: input.readinessScoreBefore ?? null,
    },
  });

  const omegaTriggered = await triggerOmegaRecompute(
    input.subjectNpi,
    input.fetchImpl ?? fetch,
  );

  return {
    blocker,
    capsuleRecorded: capsuleResult.ok,
    omegaTriggered,
  };
}

export function shouldReleasePassportAction(
  input: PassportActionReleaseInput,
): boolean {
  if (!input.resolvingBlocker) {
    return false;
  }

  if (
    input.phase === 'error'
    || input.phase === 'done'
    || input.isUsable
    || Boolean(input.completedAt)
    || Boolean(input.readyAt)
  ) {
    return true;
  }

  return (
    input.currentReadinessScore !== undefined
    && input.baselineReadinessScore !== undefined
    && input.currentReadinessScore !== input.baselineReadinessScore
  );
}
