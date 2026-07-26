/**
 * DevKeysNotice decision helpers — the guard rail against the silent
 * local-auth failure mode (pk_live keys off their bound domain).
 */
import { describe, expect, it } from 'vitest';
import { liveKeyDomain, shouldWarnAboutLiveKeys } from '@/components/auth/DevKeysNotice';

// pk_live_ + base64("clerk.vitalcv.com$") — the real production key shape.
const LIVE_KEY = `pk_live_${Buffer.from('clerk.vitalcv.com$').toString('base64')}`;
const TEST_KEY = `pk_test_${Buffer.from('funky-mole-42.clerk.accounts.dev$').toString('base64')}`;

describe('liveKeyDomain', () => {
  it('decodes the bound apex domain from a pk_live key', () => {
    expect(liveKeyDomain(LIVE_KEY)).toBe('vitalcv.com');
  });

  it('returns null for pk_test keys', () => {
    expect(liveKeyDomain(TEST_KEY)).toBeNull();
  });

  it('returns null for missing or malformed keys', () => {
    expect(liveKeyDomain(undefined)).toBeNull();
    expect(liveKeyDomain('')).toBeNull();
    expect(liveKeyDomain('pk_live_not-base64!!!')).toBeNull();
  });
});

describe('shouldWarnAboutLiveKeys', () => {
  it('warns on localhost with live keys', () => {
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, 'localhost')).toBe(true);
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, '127.0.0.1')).toBe(true);
  });

  it('stays quiet on the bound domain and its subdomains', () => {
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, 'vitalcv.com')).toBe(false);
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, 'www.vitalcv.com')).toBe(false);
  });

  it('never warns for pk_test keys anywhere', () => {
    expect(shouldWarnAboutLiveKeys(TEST_KEY, 'localhost')).toBe(false);
    expect(shouldWarnAboutLiveKeys(TEST_KEY, 'vitalcv.com')).toBe(false);
  });

  it('does not treat lookalike domains as bound', () => {
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, 'evilvitalcv.com')).toBe(true);
    expect(shouldWarnAboutLiveKeys(LIVE_KEY, 'vitalcv.com.attacker.io')).toBe(true);
  });
});
