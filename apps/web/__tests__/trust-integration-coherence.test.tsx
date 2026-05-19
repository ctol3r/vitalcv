import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  READING_ORDER_LABELS,
  findBannedInstitutionalPhrases,
} from '@/lib/trust/institutional-language';
import { LINEAGE_SLOT_ORDER } from '@/lib/trust/replay-grammar';

/**
 * Coherence test suite for the trust-integration wave.
 *
 * Asserts that the three integrated trust-canon routes
 * (`/receipt/[receiptId]`, `/verify/receipt/[receiptId]`,
 * `/dossier/[receiptId]`) all wire the canonical `LineageHeader`
 * primitive through `composeLineage(...)` with the binding
 * reading-order tuple, and that no touched file regresses the
 * truth-contract banned-phrase guard.
 *
 * This is a static-source-level test — it does not render the routes.
 * Route rendering correctness is covered by the primitive-render tests
 * in `institutional-trust-primitives.test.tsx`.
 */

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const INTEGRATED_ROUTES = [
  'apps/web/app/receipt/[receiptId]/page.tsx',
  'apps/web/app/verify/receipt/[receiptId]/page.tsx',
  'apps/web/app/dossier/[receiptId]/page.tsx',
] as const;

function readRoute(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function stripDeclarativeMatter(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

describe('coherence · canonical LineageHeader integration', () => {
  it.each(INTEGRATED_ROUTES)(
    '%s imports the canonical LineageHeader primitive',
    (rel) => {
      const src = readRoute(rel);
      expect(src).toMatch(
        /from\s+['"]@\/components\/trust\/primitives['"]/,
      );
      expect(src).toMatch(/LineageHeader/);
    },
  );

  it.each(INTEGRATED_ROUTES)(
    '%s composes lineage through the canonical helper (not an ad-hoc array)',
    (rel) => {
      const src = readRoute(rel);
      expect(src).toMatch(
        /from\s+['"]@\/lib\/trust\/replay-grammar['"]/,
      );
      expect(src).toMatch(/composeLineage\s*\(/);
    },
  );

  it.each(INTEGRATED_ROUTES)(
    '%s passes all six slots to composeLineage in some order',
    (rel) => {
      const src = readRoute(rel);
      for (const slotKey of LINEAGE_SLOT_ORDER) {
        expect(src).toMatch(new RegExp(`${slotKey}\\s*:`));
      }
    },
  );
});

describe('coherence · name-collision resolved in /verify/receipt', () => {
  it('local LineageHeader was renamed to ReplayInspectionHeader', () => {
    const src = readRoute(
      'apps/web/app/verify/receipt/[receiptId]/page.tsx',
    );
    // Canonical primitive is imported under an alias.
    expect(src).toMatch(/LineageHeader as CanonicalLineageHeader/);
    // The route-local function uses its renamed name.
    expect(src).toMatch(/function ReplayInspectionHeader/);
    // The legacy `function LineageHeader` declaration is gone.
    expect(src).not.toMatch(/function LineageHeader\b/);
  });
});

describe('coherence · canonical reading-order labels are reused, not redefined', () => {
  it('READING_ORDER_LABELS preserves the binding order on every key', () => {
    expect(READING_ORDER_LABELS.object).toBe('Object');
    expect(READING_ORDER_LABELS.ownership).toBe('Ownership');
    expect(READING_ORDER_LABELS.checkedAt).toBe('checked_at');
    expect(READING_ORDER_LABELS.channel).toBe('Channel');
    expect(READING_ORDER_LABELS.replay).toBe('Replay');
    expect(READING_ORDER_LABELS.runId).toBe('run_id');
  });
});

describe('truth-contract · integrated routes pass the banned-phrase guard', () => {
  it.each(INTEGRATED_ROUTES)(
    '%s contains no banned institutional phrases',
    (rel) => {
      const src = readRoute(rel);
      const hits = findBannedInstitutionalPhrases(
        stripDeclarativeMatter(src),
      );
      expect(hits).toEqual([]);
    },
  );
});
