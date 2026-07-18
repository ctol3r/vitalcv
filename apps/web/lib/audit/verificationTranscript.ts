/**
 * Verification transcript (W5) — the Merkle-inclusion proof, rendered as a
 * stepwise trace an auditor can follow.
 *
 * The backend (`apps/api/backend/src/routes/audit.ts` buildVerificationSteps)
 * already emits the real trace as a `string[]`:
 *   "Start: leaf = <hash>"
 *   "Level N: H(<a>… || <b>…) = <hash>…"
 *   "Root matches: <root> ✓"   |   "Root MISMATCH — expected <root>"
 *
 * This parses that verbatim into a structured, render-ready shape and derives
 * the honest result. It reasons ONLY over what the backend actually computes
 * (Merkle inclusion) — it does not fabricate an event-chain step the ledger
 * does not surface here. A MISMATCH fails closed and locates the break at the
 * root comparison. Pure + deterministic.
 */

export type TranscriptStatus = 'ok' | 'fail' | 'info';
export type TranscriptStepKind = 'start' | 'level' | 'root';
export type TranscriptResult = 'verified' | 'failed' | 'pending';

export interface TranscriptStep {
  text: string;
  kind: TranscriptStepKind;
  status: TranscriptStatus;
}

export interface ParsedTranscript {
  steps: TranscriptStep[];
  result: TranscriptResult;
}

const ROOT_MISMATCH = /^Root\s+MISMATCH/i;
const ROOT_MATCH = /^Root\s+matches/i;
const START = /^Start\s*:/i;

/** Parse the backend `verificationSteps` string[] into render-ready steps. */
export function parseVerificationSteps(raw: ReadonlyArray<string>): ParsedTranscript {
  const steps: TranscriptStep[] = raw.map((text, i) => {
    if (ROOT_MISMATCH.test(text)) return { text, kind: 'root', status: 'fail' };
    if (ROOT_MATCH.test(text)) return { text, kind: 'root', status: 'ok' };
    if (i === 0 || START.test(text)) return { text, kind: 'start', status: 'info' };
    return { text, kind: 'level', status: 'info' };
  });

  const root = steps.find((s) => s.kind === 'root');
  const result: TranscriptResult = !root ? 'pending' : root.status === 'fail' ? 'failed' : 'verified';
  return { steps, result };
}
