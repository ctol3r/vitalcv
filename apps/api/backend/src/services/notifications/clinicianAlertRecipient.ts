/**
 * N1 — resolve whether the sweep may email the clinician, and where.
 *
 * Before this existed, `dispatchMonitoringAlert` sent a clinician's expiring
 * credential to their EMPLOYERS and an ops inbox, and never to them. This
 * module is the gate that lets the clinician be added as a recipient without
 * that becoming "we mail everyone we have an address for."
 *
 * Five conditions, each of which fails CLOSED and reports a distinct reason
 * so an operator can tell "they said no" from "we have no address" from "we
 * already told them today":
 *
 *   1. the clinician has a profile with a verified email on file;
 *   2. contact consent for EMAIL is currently granted (ledger fold, not a
 *      flag, and never inferred from the verified email itself);
 *   3. their preference row is active;
 *   4. the alert's severity meets their floor;
 *   5. the same finding has not already been sent inside their suppression
 *      window.
 *
 * Condition 5 is enforced by claiming a unique `dedupeKey` on
 * `AlertDeliveryAttempt` — the row IS the claim, so two concurrent sweeps
 * cannot both send, and the suppression is ledgered rather than silent.
 */
import prisma from '../../graphql/prisma_client';

export type ClinicianAlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SEVERITY_RANK: Record<ClinicianAlertSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const DEFAULT_SEVERITY_FLOOR: ClinicianAlertSeverity = 'HIGH';
const DEFAULT_SUPPRESSION_MINUTES = 1440;

export type ClinicianRecipientRefusal =
  | 'no_profile'
  | 'no_verified_email'
  | 'consent_not_granted'
  | 'preference_inactive'
  | 'below_severity_floor'
  | 'channel_not_selected'
  | 'lookup_failed';

export type ClinicianRecipientDecision =
  | { deliverable: true; email: string; suppressionWindowMinutes: number }
  | { deliverable: false; reason: ClinicianRecipientRefusal };

function isSeverity(value: unknown): value is ClinicianAlertSeverity {
  return typeof value === 'string' && value in SEVERITY_RANK;
}

/**
 * Decide whether this clinician may receive this alert. Read-only; claiming
 * the send window is a separate, explicit step (`claimClinicianAlertSend`)
 * so a caller cannot accidentally consume a suppression slot while merely
 * asking a question.
 */
export async function resolveClinicianAlertRecipient(
  npi: string,
  severity: ClinicianAlertSeverity,
): Promise<ClinicianRecipientDecision> {
  try {
    const profile = await prisma.personProfile.findFirst({
      where: { npi },
      select: { verifiedEmail: true },
    });
    if (!profile) return { deliverable: false, reason: 'no_profile' };

    const email = profile.verifiedEmail?.trim();
    if (!email || !email.includes('@')) {
      return { deliverable: false, reason: 'no_verified_email' };
    }

    // Consent: the highest-`seq` event per (npi, channel) governs. A verified
    // email is an address, not permission — only this decides.
    const consentHead = await prisma.clinicianContactConsentEvent.findFirst({
      where: { clinicianNpi: npi, channel: 'EMAIL' },
      orderBy: { seq: 'desc' },
      select: { kind: true },
    });
    if (consentHead?.kind !== 'granted') {
      return { deliverable: false, reason: 'consent_not_granted' };
    }

    const preference = await prisma.clinicianNotificationPreference.findUnique({
      where: { clinicianNpi: npi },
    });
    if (preference && !preference.active) {
      return { deliverable: false, reason: 'preference_inactive' };
    }
    if (preference && !preference.channels.includes('EMAIL')) {
      return { deliverable: false, reason: 'channel_not_selected' };
    }

    const floor = isSeverity(preference?.severityFloor)
      ? preference.severityFloor
      : DEFAULT_SEVERITY_FLOOR;
    if (SEVERITY_RANK[severity] < SEVERITY_RANK[floor]) {
      return { deliverable: false, reason: 'below_severity_floor' };
    }

    return {
      deliverable: true,
      email,
      suppressionWindowMinutes:
        preference?.suppressionWindowMinutes ?? DEFAULT_SUPPRESSION_MINUTES,
    };
  } catch {
    // Fail closed: an unreadable consent state is not permission.
    return { deliverable: false, reason: 'lookup_failed' };
  }
}

/**
 * Deterministic key for one finding inside one suppression window. Bucketing
 * by window means a daily sweep re-deriving the same alert produces the same
 * key and therefore cannot send twice.
 */
export function clinicianAlertDedupeKey(input: {
  npi: string;
  kind: string;
  credentialId?: string;
  suppressionWindowMinutes: number;
  now: Date;
}): string {
  const windowMs = Math.max(1, input.suppressionWindowMinutes) * 60_000;
  const bucket = Math.floor(input.now.getTime() / windowMs);
  return [
    'clinician',
    input.npi,
    input.kind,
    input.credentialId ?? 'none',
    `w${bucket}`,
  ].join(':');
}

export type ClinicianSendClaim =
  | { claimed: true; attemptId: string; dedupeKey: string }
  | { claimed: false; reason: 'suppressed_within_window' | 'claim_failed'; dedupeKey: string };

/**
 * Claim the right to send. The unique `dedupeKey` on AlertDeliveryAttempt is
 * the claim: if the row already exists we are inside the window and must not
 * send again. A `PENDING` row is written first and settled afterwards, so a
 * crash mid-send leaves evidence rather than a silent gap.
 */
export async function claimClinicianAlertSend(input: {
  npi: string;
  kind: string;
  credentialId?: string;
  destination: string;
  suppressionWindowMinutes: number;
  now?: Date;
}): Promise<ClinicianSendClaim> {
  const dedupeKey = clinicianAlertDedupeKey({
    npi: input.npi,
    kind: input.kind,
    credentialId: input.credentialId,
    suppressionWindowMinutes: input.suppressionWindowMinutes,
    now: input.now ?? new Date(),
  });

  try {
    const row = await prisma.alertDeliveryAttempt.create({
      data: {
        channel: 'EMAIL',
        destination: input.destination,
        status: 'PENDING',
        dedupeKey,
        payload: { audience: 'clinician', kind: input.kind, npi: `${input.npi.slice(0, 4)}****` },
      },
      select: { id: true },
    });
    return { claimed: true, attemptId: row.id, dedupeKey };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return { claimed: false, reason: 'suppressed_within_window', dedupeKey };
    }
    return { claimed: false, reason: 'claim_failed', dedupeKey };
  }
}

/** Settle a claimed attempt. Never throws — the send already happened or did not. */
export async function settleClinicianAlertSend(
  attemptId: string,
  outcome: { status: 'DELIVERED' | 'FAILED' | 'NOT_CONFIGURED'; errorText?: string },
): Promise<void> {
  try {
    await prisma.alertDeliveryAttempt.update({
      where: { id: attemptId },
      data: { status: outcome.status, errorText: outcome.errorText ?? null },
    });
  } catch {
    // Settling is best-effort; the PENDING row remains as honest evidence.
  }
}
