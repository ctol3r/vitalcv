/**
 * Where the MATCHA preferences on screen actually live, and whether the last edit reached
 * anywhere durable.
 *
 * The preferences client used to swallow both questions. A 401, a degraded read, and a
 * genuinely empty account all arrived as "no server data, keep using the local copy", and a
 * failed write arrived as nothing at all — so the interface said "MATCHA understands you"
 * with equal confidence whether the answers were saved to the account, stranded in one
 * browser, or lost. This module names the states so a surface can say which one it is in.
 *
 * Pure and framework-free: {@link describeSync} is the single place the wording lives.
 */

export type MatchaSyncStatus =
  /** Identity not resolved yet — nothing can be claimed about where the data lives. */
  | 'pending'
  /** Signed out. The browser is the only store, and that is the intended contract. */
  | 'device'
  /** Signed in and the account store answered. Edits follow the clinician across devices. */
  | 'synced'
  /** Signed in but the account store did not answer. The browser copy is all there is. */
  | 'degraded';

export interface MatchaSyncNotice {
  tone: 'info' | 'warn';
  /** Short chip label. */
  label: string;
  /** One sentence naming what is and is not durable. */
  detail: string;
}

/**
 * The notice a surface should show, or `null` when there is nothing honest to add —
 * either the account store is holding the answers (the quiet, correct case) or the
 * session has not resolved and any claim would be a guess.
 *
 * `unsaved` reports that the most recent durable write did not land. It is meaningful
 * only for a signed-in account; a signed-out session never attempts one.
 */
export function describeSync(
  status: MatchaSyncStatus,
  unsaved: boolean,
): MatchaSyncNotice | null {
  if (status === 'pending') return null;

  if (status === 'device') {
    return {
      tone: 'info',
      label: 'Saved on this device',
      detail:
        'You are signed out, so these answers stay in this browser. Sign in to keep them with your account.',
    };
  }

  if (status === 'degraded') {
    return {
      tone: 'warn',
      label: 'Saved on this device',
      detail:
        'We cannot reach your account right now, so these answers are held in this browser only and will not follow you to another device.',
    };
  }

  if (unsaved) {
    return {
      tone: 'warn',
      label: 'Last change not saved',
      detail:
        'Your most recent answer did not reach your account. It is held in this browser — try again to save it.',
    };
  }

  return null;
}
