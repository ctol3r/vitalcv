/**
 * otpCore — the pure, I/O-free heart of email-OTP identity binding.
 *
 * Everything security-critical lives here so it can be unit-tested exhaustively:
 * code generation (CSPRNG), salted hashing (the plaintext code is never stored
 * or logged), and the attempt evaluator (expiry / single-use / attempt-cap /
 * constant-time compare). The DB-backed service is a thin wrapper around this.
 */
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { sha256Hex } from '../../utils/deterministic';

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // per challenge, then locked out
export const OTP_MAX_ISSUES_PER_WINDOW = 5; // per email, per window
export const OTP_ISSUE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Cryptographically-random 6-digit code, zero-padded. Never logged. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Per-challenge random salt (hex). */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/** Salted SHA-256 of a code. The plaintext code is never persisted. */
export function hashOtpCode(code: string, salt: string): string {
  return sha256Hex(`${salt}:${code}`);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function emailDomain(email: string): string {
  return normalizeEmail(email).split('@')[1] ?? '';
}

function timingSafeEqualHex(a: string, b: string): boolean {
  let ba: Buffer;
  let bb: Buffer;
  try {
    ba = Buffer.from(a, 'hex');
    bb = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface OtpChallenge {
  codeHash: string;
  salt: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export type OtpOutcome =
  | 'verified'
  | 'no_challenge'
  | 'expired'
  | 'already_used'
  | 'locked_out'
  | 'code_mismatch';

/**
 * Evaluate a submitted code against a stored challenge. Pure — no I/O.
 *
 * Guard order is deliberate: absent → already-used → expired → locked → compare.
 * The final comparison is constant-time so a wrong code can't be distinguished
 * from a right one by timing. `attemptsAfter` is what the caller must persist
 * (an attempt is only "spent" once we reach the compare step).
 */
export function evaluateOtpAttempt(params: {
  challenge: OtpChallenge | null;
  submittedCode: string;
  now: Date;
  maxAttempts?: number;
}): { outcome: OtpOutcome; attemptsAfter: number } {
  const { challenge, submittedCode, now } = params;
  const maxAttempts = params.maxAttempts ?? OTP_MAX_ATTEMPTS;

  if (!challenge) return { outcome: 'no_challenge', attemptsAfter: 0 };
  if (challenge.consumedAt) return { outcome: 'already_used', attemptsAfter: challenge.attempts };
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    return { outcome: 'expired', attemptsAfter: challenge.attempts };
  }
  if (challenge.attempts >= maxAttempts) {
    return { outcome: 'locked_out', attemptsAfter: challenge.attempts };
  }

  const submittedHash = hashOtpCode(submittedCode, challenge.salt);
  const matches = timingSafeEqualHex(submittedHash, challenge.codeHash);
  const attemptsAfter = challenge.attempts + 1;
  return { outcome: matches ? 'verified' : 'code_mismatch', attemptsAfter };
}
