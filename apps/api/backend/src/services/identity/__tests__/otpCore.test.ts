/**
 * otpCore — security-core unit tests.
 *
 * Pins the invariants email-OTP identity binding depends on: codes are 6-digit
 * CSPRNG, hashing is salted + deterministic + code-sensitive, and the attempt
 * evaluator honors guard order (absent → used → expired → locked → compare),
 * spends an attempt only at the compare step, and never crashes on malformed
 * hashes.
 */
import {
  emailDomain,
  evaluateOtpAttempt,
  generateOtpCode,
  generateSalt,
  hashOtpCode,
  isPlausibleEmail,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
  type OtpChallenge,
} from '../otpCore';

function challenge(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  const salt = 'saltsaltsaltsalt';
  return {
    salt,
    codeHash: hashOtpCode('123456', salt),
    expiresAt: new Date('2026-07-04T12:10:00Z'),
    attempts: 0,
    consumedAt: null,
    ...overrides,
  };
}

const NOW = new Date('2026-07-04T12:00:00Z');

describe('code generation + hashing', () => {
  it('generates a zero-padded 6-digit numeric code', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(0);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    }
  });

  it('hashes deterministically, but differently per code and per salt', () => {
    const salt = generateSalt();
    expect(hashOtpCode('123456', salt)).toBe(hashOtpCode('123456', salt));
    expect(hashOtpCode('123456', salt)).not.toBe(hashOtpCode('654321', salt));
    expect(hashOtpCode('123456', salt)).not.toBe(hashOtpCode('123456', generateSalt()));
    // The plaintext code must not be recoverable from the hash.
    expect(hashOtpCode('123456', salt)).not.toContain('123456');
  });
});

describe('evaluateOtpAttempt — outcomes', () => {
  it('verifies the correct code and spends one attempt', () => {
    const r = evaluateOtpAttempt({ challenge: challenge(), submittedCode: '123456', now: NOW });
    expect(r.outcome).toBe('verified');
    expect(r.attemptsAfter).toBe(1);
  });

  it('rejects a wrong code as code_mismatch and spends one attempt', () => {
    const r = evaluateOtpAttempt({ challenge: challenge(), submittedCode: '000000', now: NOW });
    expect(r.outcome).toBe('code_mismatch');
    expect(r.attemptsAfter).toBe(1);
  });

  it('returns no_challenge for a null challenge (no attempt spent)', () => {
    const r = evaluateOtpAttempt({ challenge: null, submittedCode: '123456', now: NOW });
    expect(r.outcome).toBe('no_challenge');
    expect(r.attemptsAfter).toBe(0);
  });

  it('rejects an already-consumed challenge before comparing', () => {
    const r = evaluateOtpAttempt({
      challenge: challenge({ consumedAt: new Date('2026-07-04T12:01:00Z') }),
      submittedCode: '123456',
      now: NOW,
    });
    expect(r.outcome).toBe('already_used');
  });

  it('rejects an expired challenge even with the right code', () => {
    const r = evaluateOtpAttempt({
      challenge: challenge({ expiresAt: new Date('2026-07-04T11:59:59Z') }),
      submittedCode: '123456',
      now: NOW,
    });
    expect(r.outcome).toBe('expired');
  });

  it('locks out once attempts reach the cap, without spending more', () => {
    const r = evaluateOtpAttempt({
      challenge: challenge({ attempts: OTP_MAX_ATTEMPTS }),
      submittedCode: '123456',
      now: NOW,
    });
    expect(r.outcome).toBe('locked_out');
    expect(r.attemptsAfter).toBe(OTP_MAX_ATTEMPTS);
  });

  it('honors guard order: consumed beats expired', () => {
    const r = evaluateOtpAttempt({
      challenge: challenge({
        consumedAt: new Date('2026-07-04T12:01:00Z'),
        expiresAt: new Date('2026-07-04T11:00:00Z'),
      }),
      submittedCode: '123456',
      now: NOW,
    });
    expect(r.outcome).toBe('already_used');
  });

  it('never crashes on a malformed stored hash — treats as mismatch', () => {
    const r = evaluateOtpAttempt({
      challenge: challenge({ codeHash: 'not-hex-zzzz' }),
      submittedCode: '123456',
      now: NOW,
    });
    expect(r.outcome).toBe('code_mismatch');
  });
});

describe('email helpers', () => {
  it('normalizes and validates plausible emails', () => {
    expect(normalizeEmail('  Dr.Smith@Hospital.ORG ')).toBe('dr.smith@hospital.org');
    expect(isPlausibleEmail('dr.smith@hospital.org')).toBe(true);
    expect(isPlausibleEmail('not-an-email')).toBe(false);
    expect(isPlausibleEmail('a@b')).toBe(false);
    expect(emailDomain('Dr.Smith@Hospital.ORG')).toBe('hospital.org');
  });
});
