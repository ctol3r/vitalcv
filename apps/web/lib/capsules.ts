/**
 * Decision Capsule client helper.
 *
 * Fires a POST to /api/decisions → proxies to backend /api/decisions.
 * Fire-and-forget: never throws to the caller; errors logged only.
 *
 * Backend requires: subjectNpi (10 digits) + decisionType.
 * Trigger events: 'verifier_decision' | 'start_attestation' | 'employment_acceptance' | 'privilege_recommendation'
 * Decision types: 'HIRING' | 'PRIVILEGING' | 'DEPLOYMENT' | 'RENEWAL'
 */

export type DecisionType = 'HIRING' | 'PRIVILEGING' | 'DEPLOYMENT' | 'RENEWAL';
export type DecisionTriggerEvent =
  | 'verifier_decision'
  | 'start_attestation'
  | 'employment_acceptance'
  | 'privilege_recommendation';

export interface WriteCapsuleInput {
  subjectNpi: string;
  decisionType: DecisionType;
  triggerEvent: DecisionTriggerEvent;
  sourceReferenceId?: string;
  verifierOrgId?: string;
  credentialIds?: string[];
  issuerIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface WriteCapsuleResult {
  ok: boolean;
  capsuleId?: string;
  error?: string;
}

export async function writeCapsule(input: WriteCapsuleInput): Promise<WriteCapsuleResult> {
  if (!/^\d{10}$/.test(input.subjectNpi)) {
    return { ok: false, error: 'invalid-npi' };
  }
  try {
    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: `http-${res.status}` };
    }
    const envelope = (await res.json().catch(() => null)) as {
      result?: { id?: string } | null;
    } | null;
    return { ok: true, capsuleId: envelope?.result?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

/**
 * Fire a capsule write without awaiting.
 * Use at trigger points where the UI must not block on capsule persistence.
 * Errors are silently swallowed — capsules are audit, not UX-critical.
 */
export function fireCapsule(input: WriteCapsuleInput): void {
  void writeCapsule(input);
}
