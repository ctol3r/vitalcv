/**
 * DegradedState + DegradedStateRow lockdown.
 *
 * Pins the truth-contract behavior:
 *   - Union has exactly 5 mutually-exclusive states.
 *   - Each state has a label, meaning, actionableBy, and isPositive.
 *   - `no_adverse_findings` is the ONLY positive state.
 *   - `narrowDegradedState` rejects unknown input (no silent default).
 *   - Renderer emits `data-degraded-state` attribute per state.
 *   - Renderer encodes positive vs. failure via glyph + ink weight,
 *     never via vibrant color.
 *   - Renderer never renders bare-word "Verified" as a label.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEGRADED_STATES,
  DEGRADED_STATE_METADATA,
  narrowDegradedState,
  isPositiveDegradedState,
  actionableBy,
  type DegradedState,
} from '../lib/degraded-state';
import { DegradedStateRow } from '../components/DegradedStateRow';

describe('DegradedState — union shape', () => {
  it('contains exactly 5 states in canonical order', () => {
    expect([...DEGRADED_STATES]).toEqual([
      'source_unreachable',
      'anonymous_restriction',
      'infra_outage',
      'no_adverse_findings',
      'issuer_unavailable',
    ]);
  });

  it('every state has complete metadata', () => {
    for (const state of DEGRADED_STATES) {
      const meta = DEGRADED_STATE_METADATA[state];
      expect(meta.label).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.meaning).toBeDefined();
      expect(meta.meaning.length).toBeGreaterThan(0);
      expect(['caller', 'source-operator', 'vitalcv-ops', 'no-action-needed']).toContain(
        meta.actionableBy,
      );
      expect(typeof meta.isPositive).toBe('boolean');
    }
  });

  it('description map is frozen', () => {
    expect(Object.isFrozen(DEGRADED_STATE_METADATA)).toBe(true);
  });
});

describe('DegradedState — exactly one positive state', () => {
  it('no_adverse_findings is the only positive state', () => {
    const positives = DEGRADED_STATES.filter((s) => DEGRADED_STATE_METADATA[s].isPositive);
    expect(positives).toEqual(['no_adverse_findings']);
  });

  it('all other states are explicitly NOT positive', () => {
    const expectedNegative: DegradedState[] = [
      'source_unreachable',
      'anonymous_restriction',
      'infra_outage',
      'issuer_unavailable',
    ];
    for (const s of expectedNegative) {
      expect(DEGRADED_STATE_METADATA[s].isPositive).toBe(false);
    }
  });

  it('isPositiveDegradedState matches metadata', () => {
    for (const s of DEGRADED_STATES) {
      expect(isPositiveDegradedState(s)).toBe(DEGRADED_STATE_METADATA[s].isPositive);
    }
  });
});

describe('DegradedState — actionableBy mapping', () => {
  it('anonymous_restriction is actionable by caller', () => {
    expect(actionableBy('anonymous_restriction')).toBe('caller');
  });

  it('source_unreachable is actionable by source-operator (external)', () => {
    expect(actionableBy('source_unreachable')).toBe('source-operator');
  });

  it('infra_outage is actionable by vitalcv-ops (we own it)', () => {
    expect(actionableBy('infra_outage')).toBe('vitalcv-ops');
  });

  it('issuer_unavailable is actionable by vitalcv-ops (config / ops)', () => {
    expect(actionableBy('issuer_unavailable')).toBe('vitalcv-ops');
  });

  it('no_adverse_findings requires no action', () => {
    expect(actionableBy('no_adverse_findings')).toBe('no-action-needed');
  });
});

describe('narrowDegradedState — fail-closed narrowing', () => {
  it('returns the state for every valid string', () => {
    for (const state of DEGRADED_STATES) {
      expect(narrowDegradedState(state)).toBe(state);
    }
  });

  it('returns null for unknown strings (no silent default)', () => {
    expect(narrowDegradedState('rogue_state')).toBeNull();
    expect(narrowDegradedState('')).toBeNull();
    expect(narrowDegradedState('SOURCE_UNREACHABLE')).toBeNull(); // case-sensitive
  });

  it('returns null for non-string input', () => {
    expect(narrowDegradedState(null)).toBeNull();
    expect(narrowDegradedState(undefined)).toBeNull();
    expect(narrowDegradedState(0)).toBeNull();
    expect(narrowDegradedState({})).toBeNull();
    expect(narrowDegradedState([])).toBeNull();
  });
});

describe('DegradedStateRow — visually distinct rendering', () => {
  it('every state renders with its data-degraded-state attribute', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      expect(html).toContain(`data-degraded-state="${state}"`);
    }
  });

  it('renders data-is-positive matching the metadata', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      const expected = DEGRADED_STATE_METADATA[state].isPositive ? 'true' : 'false';
      expect(html).toContain(`data-is-positive="${expected}"`);
    }
  });

  it('renders data-actionable-by matching the metadata', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      const expected = DEGRADED_STATE_METADATA[state].actionableBy;
      expect(html).toContain(`data-actionable-by="${expected}"`);
    }
  });

  it('renders the state label', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      expect(html).toContain(DEGRADED_STATE_METADATA[state].label);
    }
  });

  it('renders the explanatory meaning text', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      // The first 30 chars of the meaning should appear; truncated to
      // avoid false-positives on minor wording changes.
      const snippet = DEGRADED_STATE_METADATA[state].meaning.slice(0, 30);
      expect(html).toContain(snippet);
    }
  });

  it('NO state renders bare-word "Verified" as a label', () => {
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      expect(html).not.toMatch(/>\s*Verified\s*</);
    }
  });

  it('renders optional context when supplied', () => {
    const html = renderToStaticMarkup(
      <DegradedStateRow state="source_unreachable" context="NPPES" />,
    );
    expect(html).toContain('NPPES');
  });

  it('renders optional checkedAt as a <time> element', () => {
    const html = renderToStaticMarkup(
      <DegradedStateRow state="no_adverse_findings" checkedAt="2026-05-12T00:00:00Z" />,
    );
    expect(html).toMatch(/<time\s[^>]*=["']2026-05-12T00:00:00Z["']/);
  });

  it('NO vibrant hue appears — monochrome doctrine inherited from #323', () => {
    // Every state renders with grayscale (RGB max-diff ≤ 16).
    for (const state of DEGRADED_STATES) {
      const html = renderToStaticMarkup(<DegradedStateRow state={state} />);
      // Catch obvious red/green hex leaks that would indicate the
      // renderer reached for color hue instead of glyph/weight.
      const redLeak = html.match(/#(?:[d-f][0-9a-f]{2})(?:00[0-9a-f]{2}|0[0-9a-f]00)/i);
      const greenLeak = html.match(/#(?:00[0-9a-f]{2})[d-f][0-9a-f]{2}/i);
      expect(redLeak).toBeNull();
      expect(greenLeak).toBeNull();
    }
  });
});

describe('DegradedStateRow — positive vs. failure visual encoding', () => {
  it('no_adverse_findings renders with the OK glyph (■)', () => {
    const html = renderToStaticMarkup(<DegradedStateRow state="no_adverse_findings" />);
    expect(html).toContain('■');
  });

  it('source_unreachable + anonymous_restriction render with ambiguity glyph (◐)', () => {
    const a = renderToStaticMarkup(<DegradedStateRow state="source_unreachable" />);
    const b = renderToStaticMarkup(<DegradedStateRow state="anonymous_restriction" />);
    expect(a).toContain('◐');
    expect(b).toContain('◐');
  });

  it('infra_outage + issuer_unavailable render with failed glyph (✕)', () => {
    const a = renderToStaticMarkup(<DegradedStateRow state="infra_outage" />);
    const b = renderToStaticMarkup(<DegradedStateRow state="issuer_unavailable" />);
    expect(a).toContain('✕');
    expect(b).toContain('✕');
  });
});

describe('DegradedState — banned strings', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const SRC = fs.readFileSync(path.resolve(__dirname, '../lib/degraded-state.ts'), 'utf8');
  const COMPONENT = fs.readFileSync(
    path.resolve(__dirname, '../components/DegradedStateRow.tsx'),
    'utf8',
  );
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  for (const phrase of BANNED) {
    it(`module does not contain: ${phrase}`, () => {
      expect(SRC).not.toContain(phrase);
    });
    it(`component does not contain: ${phrase}`, () => {
      expect(COMPONENT).not.toContain(phrase);
    });
  }
});
