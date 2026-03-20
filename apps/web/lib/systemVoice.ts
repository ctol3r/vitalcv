/**
 * systemVoice.ts — Central UI copy constants for operator-grade tone
 *
 * All user-facing microcopy should reference these constants.
 * The voice is: precise, authoritative, impersonal.
 *
 * "Signal detected" not "Something happened"
 * "Execute recommendation" not "Submit" or "Click here"
 * "Command resolved" not "Done!" or "Success!"
 */

export const systemVoice = {
  // ── Signal status ──────────────────────────────────────────
  signalDetected: 'Signal detected',
  recommendationReady: 'Recommendation ready',
  actionRequired: 'Action required',
  standby: 'Standing by',
  monitoring: 'Monitoring',
  processingSignal: 'Processing signal…',
  signalResolved: 'Signal resolved',

  // ── Command lifecycle ──────────────────────────────────────
  executingCommand: 'Executing…',
  commandResolved: 'Command resolved',
  systemUpdated: 'System updated',
  confirmAction: 'Confirm action',

  // ── Action verbs (replace "Submit", "Click here", etc.) ───
  execute: 'Execute',
  executeRecommendation: 'Execute recommendation',
  deferSignal: 'Defer signal',
  dismissSignal: 'Dismiss signal',
  initiateVerification: 'Initiate verification',
  confirmIdentity: 'Confirm identity',
  commitDecision: 'Commit decision',
  escalateSignal: 'Escalate signal',
  resolveSignal: 'Resolve signal',

  // ── Credential / Trust states ──────────────────────────────
  credentialLocked: 'Credential locked',
  trustVerified: 'Trust verified',
  verificationComplete: 'Verification complete',
  readinessConfirmed: 'Readiness confirmed',

  // ── Navigation / UX ────────────────────────────────────────
  viewSignals: 'View signals',
  openInvestigation: 'Open investigation',
  reviewEvidence: 'Review evidence',
  inspectDetails: 'Inspect details',

  // ── Toast / Confirmation ───────────────────────────────────
  toast: {
    commandAccepted: 'Command accepted',
    commandResolved: 'Command resolved',
    signalDismissed: 'Signal dismissed',
    signalDeferred: 'Signal deferred',
    actionFailed: 'Action failed — retry available',
    systemSynced: 'System synced',
  },
} as const;

export type SystemVoiceKey = keyof typeof systemVoice;
