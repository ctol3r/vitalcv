/**
 * Record an optional pass reason (PR J6b).
 *
 * A reason annotates an ALREADY-recorded pass: the swipe emitted a `passed`
 * decision immediately, and this appends a second `passed` row carrying the
 * reason. Latest-wins keeps the decision unchanged (still passed) and attaches
 * the reason — the append-only log stays honest and no decision is rewritten.
 *
 * Emitted OUT of the deck's signal outbox (a direct fire-and-forget POST, like
 * the apply-funnel signal) so it never pollutes the deck's client signal mirror
 * or its exactly-once decision counts. The reason is PRIVATE preference data and
 * is never exposed to employers. Best-effort: a failed reason must never affect
 * the pass it annotates.
 */

function reasonSignalId(opportunityId: string): string {
  const rand = Array.from({ length: 3 }, () => Math.floor(Math.random() * 1e9).toString(36)).join('')
  return `passreason-${opportunityId.slice(0, 24)}-${rand}`
}

export interface PassReasonInput {
  opportunityId: string
  opportunityVersion?: string | null
  reason: string
  npi?: string | null
}

export async function emitPassReason(input: PassReasonInput): Promise<void> {
  try {
    await fetch('/api/matcha/deck/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'passed',
        opportunityId: input.opportunityId,
        opportunityVersion: input.opportunityVersion ?? undefined,
        reason: input.reason,
        npi: input.npi ?? undefined,
        clientSignalId: reasonSignalId(input.opportunityId),
      }),
    })
  } catch {
    // Best-effort: a pass reason is optional preference data, never load-bearing.
  }
}
