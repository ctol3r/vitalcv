/**
 * emailOtpService — DB-backed email-OTP identity binding.
 *
 * A thin wrapper over the pure {@link otpCore}: it issues a challenge (rate
 * limited, code hashed + never returned), verifies a submitted code, and on
 * success records a POSSESSION SIGNAL (verified work email) on the
 * PersonProfile plus a hashed audit row. This corroborates NPI->person binding;
 * it is not a license or identity verification on its own.
 */
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import {
  getNotificationProvider,
  isEmailDeliveryConfigured,
} from '../providers/notificationProvider';
import {
  emailDomain,
  evaluateOtpAttempt,
  generateOtpCode,
  generateSalt,
  hashOtpCode,
  isPlausibleEmail,
  normalizeEmail,
  OTP_ISSUE_WINDOW_MS,
  OTP_MAX_ISSUES_PER_WINDOW,
  OTP_TTL_MS,
  type OtpOutcome,
} from './otpCore';

async function emitAudit(
  type: string,
  referenceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const hash = sha256ForPayload({ type, referenceId, metadata });
  await prisma.auditEvent.create({
    data: { type, hash, referenceId, metadata: JSON.parse(JSON.stringify(metadata)) },
  });
}

export type IssueOutcome = 'sent' | 'invalid_email' | 'rate_limited' | 'delivery_unavailable';

export async function issueEmailOtp(
  userId: string,
  rawEmail: string,
): Promise<{ outcome: IssueOutcome; email: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isPlausibleEmail(email)) {
    return { outcome: 'invalid_email', email };
  }

  // Honesty gate: never mint a challenge (or tell the user a code was sent)
  // in an environment that cannot deliver email at all.
  if (!isEmailDeliveryConfigured()) {
    log('warn', 'email_otp_delivery_unconfigured', {
      userId,
      emailDomain: emailDomain(email),
    });
    return { outcome: 'delivery_unavailable', email };
  }

  // Rate limit: cap challenges per (user, email) within the window.
  const windowStart = new Date(Date.now() - OTP_ISSUE_WINDOW_MS);
  const recentCount = await prisma.emailOtp.count({
    where: { userId, email, createdAt: { gte: windowStart } },
  });
  if (recentCount >= OTP_MAX_ISSUES_PER_WINDOW) {
    log('warn', 'email_otp_rate_limited', { userId, emailDomain: emailDomain(email) });
    return { outcome: 'rate_limited', email };
  }

  const code = generateOtpCode();
  const salt = generateSalt();
  await prisma.emailOtp.create({
    data: {
      userId,
      email,
      codeHash: hashOtpCode(code, salt),
      salt,
      purpose: 'identity_email',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // The challenge row is only useful if the code reaches an inbox: a failed
  // send reports delivery_unavailable instead of pretending the code is out.
  try {
    await getNotificationProvider().send(
      email,
      'Your VitalCV verification code',
      `Your VitalCV identity verification code is ${code}. It expires in 10 minutes. `
        + `If you did not request this, you can ignore this email.`,
    );
  } catch (err) {
    log('error', 'email_otp_send_failed', {
      userId,
      emailDomain: emailDomain(email),
      error: err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'delivery_unavailable', email };
  }

  // Audit records only the domain — never the code or full address.
  await emitAudit('identity_email_otp_issued', userId, { emailDomain: emailDomain(email) });

  return { outcome: 'sent', email };
}

export async function verifyEmailOtp(
  userId: string,
  rawEmail: string,
  submittedCode: string,
): Promise<{ outcome: OtpOutcome }> {
  const email = normalizeEmail(rawEmail);

  const row = await prisma.emailOtp.findFirst({
    where: { userId, email, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const result = evaluateOtpAttempt({
    challenge: row
      ? {
          codeHash: row.codeHash,
          salt: row.salt,
          expiresAt: row.expiresAt,
          attempts: row.attempts,
          consumedAt: row.consumedAt,
        }
      : null,
    submittedCode,
    now,
  });

  if (row) {
    // Persist the spent attempt; consume the challenge on success.
    await prisma.emailOtp.update({
      where: { id: row.id },
      data: {
        attempts: result.attemptsAfter,
        consumedAt: result.outcome === 'verified' ? now : undefined,
      },
    });
  }

  if (result.outcome === 'verified') {
    await prisma.personProfile.updateMany({
      where: { userId },
      data: { verifiedEmail: email, verifiedEmailAt: now, updatedAt: now },
    });
    await emitAudit('identity_email_verified', userId, { emailDomain: emailDomain(email) });
    log('info', 'email_otp_verified', { userId, emailDomain: emailDomain(email) });
  }

  return { outcome: result.outcome };
}
