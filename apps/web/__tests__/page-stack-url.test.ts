import { describe, expect, it } from 'vitest';

import {
  formatPaneParams,
  formatPaneToken,
  paneKeysEqual,
  parsePaneParams,
  parsePaneToken,
} from '@/lib/page-stack/pane-key';
import type { PaneKey } from '@/lib/page-stack/types';

describe('pane token round-trip', () => {
  it('formats and re-parses a simple key', () => {
    const key: PaneKey = { type: 'opportunity', id: 'opp_123' };
    expect(formatPaneToken(key)).toBe('opportunity:opp_123');
    expect(parsePaneToken('opportunity:opp_123')).toEqual(key);
  });

  it('survives ids containing colons and reserved characters', () => {
    const key: PaneKey = { type: 'evidence_claim', id: 'claim:abc/def?x=1' };
    const token = formatPaneToken(key);
    // The id is percent-encoded, so the only literal colon is the type separator.
    expect(token.indexOf(':')).toBe('evidence_claim'.length);
    expect(parsePaneToken(token)).toEqual(key);
  });

  it('round-trips every pane type', () => {
    for (const key of [
      { type: 'opportunity', id: 'a' },
      { type: 'employer', id: 'b' },
      { type: 'evidence_claim', id: 'c' },
    ] as const) {
      expect(parsePaneToken(formatPaneToken(key))).toEqual(key);
    }
  });
});

describe('parsePaneToken — rejects what it cannot resolve', () => {
  it('drops an unknown type rather than rendering it', () => {
    expect(parsePaneToken('clinician:me')).toBeNull(); // real graph node, but not a pane vocabulary type
    expect(parsePaneToken('wallet:x')).toBeNull();
    expect(parsePaneToken('nonsense:x')).toBeNull();
  });

  it('rejects structurally malformed tokens', () => {
    expect(parsePaneToken('')).toBeNull();
    expect(parsePaneToken('opportunity')).toBeNull(); // no colon
    expect(parsePaneToken(':opp_1')).toBeNull(); // no type
    expect(parsePaneToken('opportunity:')).toBeNull(); // no id
  });

  it('drops a token with broken percent-encoding instead of throwing', () => {
    // A lone % is invalid input to decodeURIComponent.
    expect(parsePaneToken('opportunity:%')).toBeNull();
    expect(() => parsePaneToken('opportunity:%')).not.toThrow();
  });
});

describe('parsePaneParams — the full stack', () => {
  it('preserves order = stack depth', () => {
    const keys = parsePaneParams(['opportunity:opp_1', 'employer:org_2', 'evidence_claim:claim_3']);
    expect(keys.map((k) => `${k.type}:${k.id}`)).toEqual([
      'opportunity:opp_1',
      'employer:org_2',
      'evidence_claim:claim_3',
    ]);
  });

  it('skips unresolvable tokens but keeps the resolvable ones in place', () => {
    const keys = parsePaneParams(['opportunity:opp_1', 'garbage', 'employer:org_2']);
    expect(keys.map((k) => k.id)).toEqual(['opp_1', 'org_2']);
  });

  it('drops a pane that appears twice so it cannot stack on itself', () => {
    const keys = parsePaneParams(['opportunity:opp_1', 'employer:org_2', 'opportunity:opp_1']);
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.id)).toEqual(['opp_1', 'org_2']);
  });

  it('is the inverse of formatPaneParams', () => {
    const keys: PaneKey[] = [
      { type: 'opportunity', id: 'opp_1' },
      { type: 'employer', id: 'org 2 with spaces' },
    ];
    expect(parsePaneParams(formatPaneParams(keys))).toEqual(keys);
  });
});

describe('paneKeysEqual', () => {
  it('compares type and id', () => {
    expect(paneKeysEqual({ type: 'opportunity', id: 'a' }, { type: 'opportunity', id: 'a' })).toBe(true);
    expect(paneKeysEqual({ type: 'opportunity', id: 'a' }, { type: 'opportunity', id: 'b' })).toBe(false);
    expect(paneKeysEqual({ type: 'opportunity', id: 'a' }, { type: 'employer', id: 'a' })).toBe(false);
  });
});
