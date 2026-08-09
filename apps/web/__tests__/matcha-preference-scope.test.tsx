// @vitest-environment jsdom
/**
 * MATCHA preference storage is bound to an identity.
 *
 * The 2026-08-08 authed audit found /holder/matcha hydrating from a single global
 * localStorage key. Whoever answered the match questions last on a browser became the
 * preference completeness, and the derived "MATCHA understands you" insights, of the next
 * account to sign in there — with no clinician binding anywhere in the read path.
 *
 * What this suite holds:
 *   - one account's cache is unreadable from another account's scope
 *   - the signed-out device bucket and an account bucket are separate stores
 *   - the pre-scoping key is NEVER adopted into an account on its own; ownership is
 *     unknowable from storage, so it takes an explicit act
 *   - the device bucket does inherit it once (identical meaning) and retires it
 *   - evicting one scope leaves every other scope intact
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEVICE_SCOPE,
  LEGACY_PREFERENCES_STORAGE_KEY,
  LEGACY_PREFERENCES_UPDATED_KEY,
  accountScope,
  adoptUnboundPreferences,
  clearStoredPreferences,
  discardUnboundPreferences,
  isAccountScope,
  loadStoredPreferences,
  readUnboundPreferences,
  savePreferences,
} from '../lib/matcha/storage';
import { countAnsweredFields } from '../lib/matcha/preferences';
import { describeSync } from '../lib/matcha/sync';

const AT = '2026-08-08T00:00:00.000Z';
const ALICE = accountScope('user_alice');
const BRETT = accountScope('user_brett');

function writeLegacyBlob(prefs: Record<string, unknown>) {
  window.localStorage.setItem(
    LEGACY_PREFERENCES_STORAGE_KEY,
    JSON.stringify({ version: 1, updatedAt: AT, preferences: prefs }),
  );
  window.localStorage.setItem(LEGACY_PREFERENCES_UPDATED_KEY, AT);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('preference scopes are separate stores', () => {
  it('one account cannot read another account\'s cached preferences', () => {
    savePreferences(ALICE, { preferredStates: ['CA'], minimumSalary: 275000 }, AT);

    expect(loadStoredPreferences(ALICE)).toEqual({
      preferredStates: ['CA'],
      minimumSalary: 275000,
    });
    expect(loadStoredPreferences(BRETT)).toEqual({});
  });

  it('the signed-out device bucket is not an account bucket', () => {
    savePreferences(DEVICE_SCOPE, { preferredStates: ['WA'] }, AT);

    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({ preferredStates: ['WA'] });
    expect(loadStoredPreferences(ALICE)).toEqual({});
    expect(isAccountScope(DEVICE_SCOPE)).toBe(false);
    expect(isAccountScope(ALICE)).toBe(true);
  });

  it('evicting one account leaves the other accounts and the device bucket intact', () => {
    savePreferences(ALICE, { preferredStates: ['CA'] }, AT);
    savePreferences(BRETT, { preferredStates: ['NY'] }, AT);
    savePreferences(DEVICE_SCOPE, { preferredStates: ['TX'] }, AT);

    clearStoredPreferences(ALICE);

    expect(loadStoredPreferences(ALICE)).toEqual({});
    expect(loadStoredPreferences(BRETT)).toEqual({ preferredStates: ['NY'] });
    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({ preferredStates: ['TX'] });
  });
});

describe('the pre-scoping key carries no identity', () => {
  it('is never adopted into an account scope by a read', () => {
    writeLegacyBlob({ preferredStates: ['CA'], desiredSalary: 300000 });

    // The regression this suite exists for: before scoping, this read returned the blob.
    expect(loadStoredPreferences(ALICE)).toEqual({});
    // And the read leaves it in place — unattributed is not the same as deleted.
    expect(countAnsweredFields(readUnboundPreferences())).toBe(2);
  });

  it('is offered to an account only through an explicit adoption', () => {
    writeLegacyBlob({ preferredStates: ['CA'], desiredSalary: 300000 });

    const adopted = adoptUnboundPreferences(ALICE, AT);

    expect(adopted).toEqual({ preferredStates: ['CA'], desiredSalary: 300000 });
    expect(loadStoredPreferences(ALICE)).toEqual({
      preferredStates: ['CA'],
      desiredSalary: 300000,
    });
    // Retired, so a second account cannot be offered the same blob afterwards.
    expect(readUnboundPreferences()).toEqual({});
    expect(loadStoredPreferences(BRETT)).toEqual({});
  });

  it('can be discarded without being attributed to anyone', () => {
    writeLegacyBlob({ preferredStates: ['CA'] });

    discardUnboundPreferences();

    expect(readUnboundPreferences()).toEqual({});
    expect(loadStoredPreferences(ALICE)).toEqual({});
    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({});
  });

  it('adopting an empty blob writes nothing', () => {
    expect(adoptUnboundPreferences(ALICE, AT)).toEqual({});
    expect(loadStoredPreferences(ALICE)).toEqual({});
  });

  it('is inherited once by the device bucket, which means the same thing', () => {
    writeLegacyBlob({ preferredStates: ['CA'] });

    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({ preferredStates: ['CA'] });
    // Retired on inheritance: it now lives in the device bucket and nowhere else, so a
    // later sign-in is not offered answers the device already claimed.
    expect(readUnboundPreferences()).toEqual({});
    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({ preferredStates: ['CA'] });
    expect(loadStoredPreferences(ALICE)).toEqual({});
  });

  it('does not overwrite answers the device bucket already holds', () => {
    savePreferences(DEVICE_SCOPE, { preferredStates: ['WA'] }, AT);
    writeLegacyBlob({ preferredStates: ['CA'] });

    expect(loadStoredPreferences(DEVICE_SCOPE)).toEqual({ preferredStates: ['WA'] });
  });
});

describe('describeSync names where the answers live', () => {
  it('says nothing before the session resolves — any claim would be a guess', () => {
    expect(describeSync('pending', false)).toBeNull();
    expect(describeSync('pending', true)).toBeNull();
  });

  it('says nothing when the account store holds the answers', () => {
    expect(describeSync('synced', false)).toBeNull();
  });

  it('flags a signed-in write that did not land', () => {
    const notice = describeSync('synced', true);
    expect(notice?.tone).toBe('warn');
    expect(notice?.label).toMatch(/not saved/i);
  });

  it('labels signed-out storage as this browser, without calling it a failure', () => {
    const notice = describeSync('device', false);
    expect(notice?.tone).toBe('info');
    expect(notice?.detail).toMatch(/this browser/i);
  });

  it('labels an unreachable account store as device-only, and warns', () => {
    const notice = describeSync('degraded', false);
    expect(notice?.tone).toBe('warn');
    expect(notice?.detail).toMatch(/this browser/i);
    // The distinction that was swallowed: degraded is not "no preferences saved".
    expect(notice?.detail).not.toMatch(/no preferences/i);
  });

  it('never claims durability it does not have', () => {
    for (const status of ['device', 'degraded'] as const) {
      const notice = describeSync(status, false);
      // These two states mean the answers are in one browser. Copy polish that
      // reintroduces a cross-device or saved-to-account claim here is the defect.
      expect(notice?.detail).not.toMatch(/across (your )?devices|saved to your account/i);
    }
  });
});

describe('the notice component carries the qualifier to the surface', () => {
  it('renders nothing when there is nothing to disclose', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { MatchaStorageNotice } = await import('../components/matcha/MatchaStorageNotice');

    expect(renderToStaticMarkup(<MatchaStorageNotice notice={null} />)).toBe('');
  });

  it('renders the degraded wording next to the completeness it qualifies', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { MatchaStorageNotice } = await import('../components/matcha/MatchaStorageNotice');

    const markup = renderToStaticMarkup(
      <MatchaStorageNotice notice={describeSync('degraded', false)} />,
    );

    expect(markup).toContain('this browser');
    expect(markup).toContain('data-matcha-sync-tone="warn"');
  });
});
