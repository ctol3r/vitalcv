/**
 * systemVoice.ts — Central UI copy constants for concise, human-first language
 *
 * All user-facing microcopy should reference these constants.
 * The voice is: precise, authoritative, impersonal.
 *
 * Keep labels outcome-focused and readable in product surfaces.
 */

export const systemVoice = {
  // ── Signal status ──────────────────────────────────────────
  signalDetected: 'Update found',
  recommendationReady: 'Recommendation ready',
  actionRequired: 'Review needed',
  standby: 'Standing by',
  monitoring: 'Monitoring',
  processingSignal: 'Updating…',
  signalResolved: 'Update reviewed',

  // ── Command lifecycle ──────────────────────────────────────
  executingCommand: 'Saving…',
  commandResolved: 'Saved',
  systemUpdated: 'Updated',
  confirmAction: 'Confirm choice',

  // ── Action verbs (replace "Submit", "Click here", etc.) ───
  execute: 'Continue',
  executeRecommendation: 'Continue',
  deferSignal: 'Save for later',
  dismissSignal: 'Dismiss',
  initiateVerification: 'Start verification',
  confirmIdentity: 'Confirm identity',
  commitDecision: 'Save decision',
  escalateSignal: 'Escalate for review',
  resolveSignal: 'Mark reviewed',

  // ── Credential / Trust states ──────────────────────────────
  credentialLocked: 'Credential locked',
  trustVerified: 'Trust verified',
  verificationComplete: 'Verification complete',
  readinessConfirmed: 'Readiness confirmed',

  // ── Navigation / UX ────────────────────────────────────────
  viewSignals: 'View details',
  openInvestigation: 'Open review',
  reviewEvidence: 'Review evidence',
  inspectDetails: 'View details',

  // ── Toast / Confirmation ───────────────────────────────────
  toast: {
    commandAccepted: 'Saved',
    commandResolved: 'Saved',
    signalDismissed: 'Dismissed',
    signalDeferred: 'Saved for later',
    actionFailed: 'We could not save that choice. Try again.',
    systemSynced: 'Up to date',
  },
} as const;

export type SystemVoiceKey = keyof typeof systemVoice;
