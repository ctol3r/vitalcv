/**
 * Apply-funnel signals (PR J5) — closes the loop from the unified decision log
 * to the sealed apply flow.
 *
 * ApplyModal is the single consent surface every apply path lands on (deck,
 * Interested queue, board, opportunity detail). Emitting the funnel signals
 * from there — `application_started` when the flow opens, `application_submitted`
 * when the packet seals — records the funnel for EVERY apply, regardless of how
 * the clinician got there, into the same append-only OpportunityAction log the
 * deck and board already write.
 *
 * These are telemetry-adjacent but they are NOT decisions and they NEVER apply,
 * consent, or share anything — the seal is the only thing that submits. Emission
 * is best-effort and fire-and-forget: a failed signal must never block or alter
 * the real apply. The signal route is idempotent on clientSignalId, so a retry
 * or a re-render can't double-count.
 */

type ApplyFunnelAction = 'application_started' | 'application_submitted'

function funnelSignalId(action: ApplyFunnelAction, opportunityId: string): string {
  const rand = Array.from({ length: 3 }, () => Math.floor(Math.random() * 1e9).toString(36)).join('')
  return `funnel-${action}-${opportunityId.slice(0, 24)}-${rand}`
}

export interface ApplyFunnelInput {
  opportunityId: string
  npi?: string | null
  /** The version the clinician applied against, when known. */
  opportunityVersion?: string | null
}

/**
 * Fire a funnel signal. Resolves regardless of outcome — the caller never awaits
 * a rejection, and a network failure is swallowed so the apply flow is untouched.
 */
export async function emitApplyFunnelSignal(
  action: ApplyFunnelAction,
  input: ApplyFunnelInput,
): Promise<void> {
  try {
    await fetch('/api/matcha/deck/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true, // survive a navigation right after submit
      body: JSON.stringify({
        action,
        opportunityId: input.opportunityId,
        npi: input.npi ?? undefined,
        opportunityVersion: input.opportunityVersion ?? undefined,
        clientSignalId: funnelSignalId(action, input.opportunityId),
      }),
    })
  } catch {
    // Best-effort: the funnel loop is not worth failing an application over.
  }
}
