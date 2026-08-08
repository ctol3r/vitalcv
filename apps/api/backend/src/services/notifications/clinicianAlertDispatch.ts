/**
 * N1 — dispatch a monitoring alert to the clinician it is about.
 *
 * Kept separate from the employer/ops loop in `continuousMonitor` on
 * purpose. The two audiences differ in every way that matters: employers are
 * reached because a business relationship exists, the clinician is reached
 * only because they asked to be; employers get an ops-style summary, the
 * clinician gets the thing that affects their livelihood; and only the
 * clinician path is consent-gated and suppression-windowed.
 *
 * Every send is ledgered twice, deliberately:
 *  - `AlertDeliveryAttempt` records the delivery mechanics (claimed →
 *    DELIVERED / FAILED / NOT_CONFIGURED) and is what enforces suppression;
 *  - `appendCommunicationEvent` records that VitalCV contacted a person,
 *    audit-first in one transaction — the ledger the codebase already
 *    defines for exactly this and which no current sender uses.
 *
 * Honesty rule inherited from `isEmailDeliveryConfigured()`: when the
 * environment can only log, nothing is recorded as delivered. The attempt
 * settles as `NOT_CONFIGURED` and the communication event carries the same
 * status, so a stub environment can never look like a mailed one.
 */
import { log } from '../../obs/logger';
import { appendCommunicationEvent } from '../communications/communicationEventService';
import { getNotificationProvider, isEmailDeliveryConfigured } from '../providers/notificationProvider';
import {
  claimClinicianAlertSend,
  resolveClinicianAlertRecipient,
  settleClinicianAlertSend,
  type ClinicianAlertSeverity,
  type ClinicianRecipientRefusal,
} from './clinicianAlertRecipient';

export interface ClinicianAlertInput {
  npi: string;
  kind: string;
  severity: ClinicianAlertSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  credentialId?: string;
}

export type ClinicianAlertOutcome =
  | { sent: true; attemptId: string }
  | { sent: false; reason: ClinicianRecipientRefusal | 'suppressed_within_window' | 'claim_failed' | 'delivery_unconfigured' | 'send_failed' };

function maskNpi(npi: string): string {
  return `${npi.slice(0, 4)}****`;
}

/**
 * Body addressed to the clinician rather than about them. The employer copy
 * reads as a risk notice; this one has to read as "here is your thing, and
 * here is what you can do about it," because that is the only reason waking
 * someone up is justified.
 */
function buildClinicianMessage(input: ClinicianAlertInput): { subject: string; body: string } {
  return {
    subject: `[VitalCV] ${input.title}`,
    body: [
      input.description,
      '',
      `What you can do: ${input.recommendedAction}`,
      '',
      'You are receiving this because you asked VitalCV to tell you about',
      'changes to your own credentials. You can turn these off at any time in',
      'your VitalCV notification settings.',
    ].join('\n'),
  };
}

export async function dispatchClinicianAlert(
  input: ClinicianAlertInput,
): Promise<ClinicianAlertOutcome> {
  const masked = maskNpi(input.npi);

  const recipient = await resolveClinicianAlertRecipient(input.npi, input.severity);
  if (!recipient.deliverable) {
    // Not an error. Most of these are the system correctly declining.
    log('info', 'clinician_alert_not_deliverable', {
      kind: input.kind,
      npi: masked,
      reason: recipient.reason,
    });
    return { sent: false, reason: recipient.reason };
  }

  const claim = await claimClinicianAlertSend({
    npi: input.npi,
    kind: input.kind,
    credentialId: input.credentialId,
    destination: recipient.email,
    suppressionWindowMinutes: recipient.suppressionWindowMinutes,
  });
  if (!claim.claimed) {
    log('info', 'clinician_alert_suppressed', {
      kind: input.kind,
      npi: masked,
      reason: claim.reason,
      suppressionWindowMinutes: recipient.suppressionWindowMinutes,
    });
    return { sent: false, reason: claim.reason };
  }

  const { subject, body } = buildClinicianMessage(input);

  // Delivery honesty: a stub environment must never settle as DELIVERED.
  if (!isEmailDeliveryConfigured()) {
    await settleClinicianAlertSend(claim.attemptId, { status: 'NOT_CONFIGURED' });
    await recordCommunication(input, recipient.email, 'not_configured', subject);
    log('warn', 'clinician_alert_delivery_unconfigured', { kind: input.kind, npi: masked });
    return { sent: false, reason: 'delivery_unconfigured' };
  }

  try {
    await getNotificationProvider().send(recipient.email, subject, body);
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    await settleClinicianAlertSend(claim.attemptId, { status: 'FAILED', errorText });
    await recordCommunication(input, recipient.email, 'failed', subject);
    log('warn', 'clinician_alert_send_failed', { kind: input.kind, npi: masked, error: errorText });
    return { sent: false, reason: 'send_failed' };
  }

  await settleClinicianAlertSend(claim.attemptId, { status: 'DELIVERED' });
  await recordCommunication(input, recipient.email, 'delivered', subject);
  log('info', 'clinician_alert_delivered', { kind: input.kind, npi: masked });
  return { sent: true, attemptId: claim.attemptId };
}

/**
 * The person-level record: VitalCV contacted this clinician, on this channel,
 * about this. Never carries the message body — `redactedSummary` and the
 * recipient domain are enough to audit a contact without storing a copy of
 * everything ever sent.
 */
async function recordCommunication(
  input: ClinicianAlertInput,
  email: string,
  status: 'delivered' | 'failed' | 'not_configured',
  subject: string,
): Promise<void> {
  try {
    await appendCommunicationEvent({
      direction: 'outbound',
      channel: 'email',
      eventType: `clinician_alert.${input.kind.toLowerCase()}`,
      status,
      recipientRef: `email:${email.split('@')[1] ?? 'unknown'}`,
      subject,
      redactedSummary: input.title,
      metadata: {
        severity: input.severity,
        npi: maskNpi(input.npi),
        ...(input.credentialId ? { credentialId: input.credentialId } : {}),
      },
    });
  } catch (err) {
    // The communication ledger must never break the sweep.
    log('warn', 'clinician_alert_communication_event_failed', {
      kind: input.kind,
      npi: maskNpi(input.npi),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
