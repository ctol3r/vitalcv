/**
 * Shared user-safe error copy for employer-action failures.
 *
 * Raw `err.message` from backend responses can leak endpoint paths,
 * internal system names, or stack hints. Every employer-facing action
 * surface that catches a submission error routes through this helper
 * so the user only ever sees one of a small set of prepared strings.
 *
 * Rule (Ω130 P0): UI never renders raw upstream text.
 */

export function employerActionErrorCopy(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (err.name === 'AbortError' || msg.includes('timed out') || msg.includes('timeout')) {
      return 'The action took too long to record. Please try again.';
    }
    if (msg.includes('fetch') || msg.includes('network')) {
      return "We couldn't reach the review service. Please retry.";
    }
    if (msg.includes('401') || msg.includes('403')) {
      return 'Sign in again to record this action.';
    }
    if (msg.includes('429')) {
      return 'Too many recent actions. Please wait a moment and try again.';
    }
  }
  return "We couldn't record this action. Please retry.";
}
