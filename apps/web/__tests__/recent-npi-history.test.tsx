/**
 * recentNpiHistory + ReplayStatusChip lockdown.
 *
 * Pins the truth-contract behavior of the recent-NPI-history client
 * primitive and the inline-styled chip renderer that consumes it.
 *
 * Covers:
 *   - typed ReplayState union (5 states, no silent default)
 *   - localStorage envelope with schema pin
 *   - move-to-front + bounded history semantics
 *   - SSR-safe (no window) path
 *   - NPI validation
 *   - chip renders all 5 states distinctly with data-replay-state
 *   - chip is monochrome (no vibrant hue)
 *   - chip never renders bare-word "Verified"
 */

import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  REPLAY_STATES,
  REPLAY_STATE_LABEL,
  RECENT_NPI_HISTORY_MAX,
  RECENT_NPI_STORAGE_KEY,
  clearRecentNpiHistory,
  forgetRecentNpi,
  getRecentNpiHistory,
  narrowReplayState,
  recordRecentNpi,
  type ReplayState,
} from '../lib/replay/recentNpiHistory';
import { ReplayStatusChip } from '../components/replay/ReplayStatusChip';

// ── localStorage shim for vitest ────────────────────────────────────
class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v);
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  key(_i: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

const VALID_NPI_A = '1346053246';
const VALID_NPI_B = '1234567890';
const VALID_NPI_C = '0987654321';

let savedWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  savedWindow = (globalThis as { window?: typeof globalThis.window }).window;
  (globalThis as { window?: { localStorage: Storage } }).window = {
    localStorage: new MemStorage() as unknown as Storage,
  } as unknown as typeof globalThis.window;
});

afterEach(() => {
  if (savedWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = savedWindow;
  }
});

describe('ReplayState — union shape', () => {
  it('contains exactly 5 states in canonical order', () => {
    expect([...REPLAY_STATES]).toEqual([
      'no_run_recorded',
      'in_flight',
      'completed_clean',
      'completed_degraded',
      'failed',
    ]);
  });

  it('every state has a label', () => {
    for (const s of REPLAY_STATES) {
      expect(REPLAY_STATE_LABEL[s]).toBeDefined();
      expect(REPLAY_STATE_LABEL[s].length).toBeGreaterThan(0);
    }
  });

  it('label map is frozen', () => {
    expect(Object.isFrozen(REPLAY_STATE_LABEL)).toBe(true);
  });

  it('no label uses bare-word "Verified"', () => {
    for (const s of REPLAY_STATES) {
      expect(REPLAY_STATE_LABEL[s]).not.toMatch(/\bVerified\b/);
    }
  });
});

describe('narrowReplayState — fail-closed narrowing', () => {
  it('returns the state for every valid string', () => {
    for (const s of REPLAY_STATES) {
      expect(narrowReplayState(s)).toBe(s);
    }
  });

  it('returns null for unknown strings (no silent default)', () => {
    expect(narrowReplayState('rogue')).toBeNull();
    expect(narrowReplayState('')).toBeNull();
    expect(narrowReplayState('FAILED')).toBeNull(); // case-sensitive
  });

  it('returns null for non-string input', () => {
    expect(narrowReplayState(null)).toBeNull();
    expect(narrowReplayState(undefined)).toBeNull();
    expect(narrowReplayState(0)).toBeNull();
    expect(narrowReplayState({})).toBeNull();
  });
});

describe('recordRecentNpi — basic mechanics', () => {
  it('starts empty', () => {
    expect(getRecentNpiHistory()).toEqual([]);
  });

  it('records a single entry', () => {
    const result = recordRecentNpi({
      npi: VALID_NPI_A,
      runId: 'run-1',
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'completed_clean',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.npi).toBe(VALID_NPI_A);
    expect(result[0]!.replayState).toBe('completed_clean');
  });

  it('rejects an NPI that is not 10 digits', () => {
    const result = recordRecentNpi({
      npi: '12345',
      runId: null,
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'no_run_recorded',
    });
    expect(result).toEqual([]);
  });

  it('move-to-front: re-recording same NPI moves it to the head', () => {
    recordRecentNpi({
      npi: VALID_NPI_A,
      runId: 'run-1',
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'completed_clean',
    });
    recordRecentNpi({
      npi: VALID_NPI_B,
      runId: 'run-2',
      checkedAt: '2026-05-12T00:01:00Z',
      replayState: 'in_flight',
    });
    const result = recordRecentNpi({
      npi: VALID_NPI_A,
      runId: 'run-3',
      checkedAt: '2026-05-12T00:02:00Z',
      replayState: 'completed_degraded',
    });
    expect(result.map((e) => e.npi)).toEqual([VALID_NPI_A, VALID_NPI_B]);
    expect(result[0]!.runId).toBe('run-3');
    expect(result[0]!.replayState).toBe('completed_degraded');
  });

  it('bounded: history never exceeds RECENT_NPI_HISTORY_MAX entries', () => {
    for (let i = 0; i < RECENT_NPI_HISTORY_MAX + 5; i++) {
      const npi = String(1000000000 + i);
      recordRecentNpi({
        npi,
        runId: `run-${i}`,
        checkedAt: '2026-05-12T00:00:00Z',
        replayState: 'no_run_recorded',
      });
    }
    expect(getRecentNpiHistory()).toHaveLength(RECENT_NPI_HISTORY_MAX);
  });

  it('persists to localStorage under the documented key', () => {
    recordRecentNpi({
      npi: VALID_NPI_A,
      runId: null,
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'no_run_recorded',
    });
    const raw = (globalThis as { window: { localStorage: Storage } }).window.localStorage.getItem(
      RECENT_NPI_STORAGE_KEY,
    );
    expect(raw).not.toBeNull();
    expect(raw).toContain('vitalcv:recent-npi-history:v1');
    expect(raw).toContain(VALID_NPI_A);
  });
});

describe('forgetRecentNpi + clearRecentNpiHistory', () => {
  it('forgets a specific NPI', () => {
    recordRecentNpi({
      npi: VALID_NPI_A,
      runId: 'r1',
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'completed_clean',
    });
    recordRecentNpi({
      npi: VALID_NPI_B,
      runId: 'r2',
      checkedAt: '2026-05-12T00:01:00Z',
      replayState: 'failed',
    });
    const result = forgetRecentNpi(VALID_NPI_A);
    expect(result.map((e) => e.npi)).toEqual([VALID_NPI_B]);
  });

  it('clearRecentNpiHistory empties the store', () => {
    recordRecentNpi({
      npi: VALID_NPI_A,
      runId: null,
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'no_run_recorded',
    });
    clearRecentNpiHistory();
    expect(getRecentNpiHistory()).toEqual([]);
  });
});

describe('recentNpiHistory — SSR safety', () => {
  it('returns empty history when window is undefined', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(getRecentNpiHistory()).toEqual([]);
  });

  it('recordRecentNpi is a no-op when window is undefined (returns current empty)', () => {
    delete (globalThis as { window?: unknown }).window;
    const result = recordRecentNpi({
      npi: VALID_NPI_A,
      runId: null,
      checkedAt: '2026-05-12T00:00:00Z',
      replayState: 'no_run_recorded',
    });
    expect(result).toEqual([]);
  });

  it('rejects entries with invalid schema during read (malformed localStorage)', () => {
    const win = (globalThis as { window: { localStorage: Storage } }).window;
    win.localStorage.setItem(RECENT_NPI_STORAGE_KEY, 'not-json-{{{');
    expect(getRecentNpiHistory()).toEqual([]);
  });

  it('drops entries with invalid NPI shape on read', () => {
    const win = (globalThis as { window: { localStorage: Storage } }).window;
    win.localStorage.setItem(
      RECENT_NPI_STORAGE_KEY,
      JSON.stringify({
        schema: 'vitalcv:recent-npi-history:v1',
        entries: [
          { npi: 'not-an-npi', runId: null, checkedAt: 'x', replayState: 'failed' },
          { npi: VALID_NPI_A, runId: null, checkedAt: 'x', replayState: 'completed_clean' },
        ],
      }),
    );
    const result = getRecentNpiHistory();
    expect(result).toHaveLength(1);
    expect(result[0]!.npi).toBe(VALID_NPI_A);
  });
});

describe('ReplayStatusChip — render', () => {
  it('every state renders with its data-replay-state attribute', () => {
    for (const state of REPLAY_STATES) {
      const html = renderToStaticMarkup(<ReplayStatusChip state={state} />);
      expect(html).toContain(`data-replay-state="${state}"`);
    }
  });

  it('renders the human label by default', () => {
    for (const state of REPLAY_STATES) {
      const html = renderToStaticMarkup(<ReplayStatusChip state={state} />);
      expect(html).toContain(REPLAY_STATE_LABEL[state]);
    }
  });

  it('compact mode omits the label (glyph-only)', () => {
    const html = renderToStaticMarkup(<ReplayStatusChip state="completed_clean" compact />);
    expect(html).not.toContain(REPLAY_STATE_LABEL.completed_clean);
    // Still has the data attribute for inspection.
    expect(html).toContain('data-replay-state="completed_clean"');
  });

  it('renders optional runId truncated to 8 chars + ellipsis', () => {
    const html = renderToStaticMarkup(
      <ReplayStatusChip state="completed_clean" runId="run-this-is-a-long-id" />,
    );
    expect(html).toContain('run-this');
    expect(html).toContain('…');
  });

  it('renders optional checkedAt as a <time> element', () => {
    const html = renderToStaticMarkup(
      <ReplayStatusChip state="completed_clean" checkedAt="2026-05-12T00:00:00Z" />,
    );
    expect(html).toMatch(/<time\s[^>]*=["']2026-05-12T00:00:00Z["']/);
  });

  it('NO state renders bare-word "Verified"', () => {
    for (const state of REPLAY_STATES) {
      const html = renderToStaticMarkup(<ReplayStatusChip state={state} />);
      expect(html).not.toMatch(/>\s*Verified\s*</);
    }
  });

  it('chip uses monochrome palette only (no vibrant red/green hex)', () => {
    for (const state of REPLAY_STATES) {
      const html = renderToStaticMarkup(<ReplayStatusChip state={state} />);
      const redLeak = html.match(/#(?:[d-f][0-9a-f]{2})00[0-9a-f]{2}/i);
      const greenLeak = html.match(/#00[0-9a-f]{2}[d-f][0-9a-f]{2}/i);
      expect(redLeak).toBeNull();
      expect(greenLeak).toBeNull();
    }
  });

  it('different states render distinct glyphs (■ ◐ ✕ ?)', () => {
    const clean = renderToStaticMarkup(<ReplayStatusChip state="completed_clean" />);
    const inFlight = renderToStaticMarkup(<ReplayStatusChip state="in_flight" />);
    const failed = renderToStaticMarkup(<ReplayStatusChip state="failed" />);
    const noRun = renderToStaticMarkup(<ReplayStatusChip state="no_run_recorded" />);
    expect(clean).toContain('■');
    expect(inFlight).toContain('◐');
    expect(failed).toContain('✕');
    expect(noRun).toContain('?');
  });
});

describe('banned-strings scan', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const LIB_SRC = fs.readFileSync(
    path.resolve(__dirname, '../lib/replay/recentNpiHistory.ts'),
    'utf8',
  );
  const CHIP_SRC = fs.readFileSync(
    path.resolve(__dirname, '../components/replay/ReplayStatusChip.tsx'),
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
    it(`recentNpiHistory.ts does not contain: ${phrase}`, () => {
      expect(LIB_SRC).not.toContain(phrase);
    });
    it(`ReplayStatusChip.tsx does not contain: ${phrase}`, () => {
      expect(CHIP_SRC).not.toContain(phrase);
    });
  }
});
