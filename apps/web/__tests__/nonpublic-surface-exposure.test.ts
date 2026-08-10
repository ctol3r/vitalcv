/**
 * Non-public surface exposure — founder ruling D-B / D-G (2026-08-09).
 *
 * Two surfaces that should not be publicly discoverable, and the two different
 * mechanisms that keep them that way:
 *
 *   /dev/*  — gated by a LAYOUT, so a harness added tomorrow is denied today.
 *   /docs   — reachable by direct link, absent from the index.
 *
 * These assert the CLOSURE, not the mechanism's spelling: the predicate's
 * behaviour and the two artefacts' agreement with each other, rather than any
 * particular line of source. A guard that matches on wording passes while the
 * thing it names quietly stops working.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isDevPreviewAllowed } from '../lib/dev/preview';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

describe('/dev/* harness gate (D-G)', () => {
  it('denies canonical production — no page-level flag can open it alone', () => {
    // The reported defect: GRAPH_EXPLORER_PREVIEW=1 could serve a developer
    // inspector in production. It no longer can; the subtree says no first.
    expect(isDevPreviewAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isDevPreviewAllowed({
        NODE_ENV: 'production',
        GRAPH_EXPLORER_PREVIEW: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('allows development, and production only on an explicit opt-in', () => {
    expect(isDevPreviewAllowed({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDevPreviewAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(true);
    // Production-mode LOCAL builds are a documented test path for several
    // harnesses; DEV_PREVIEW keeps them working without opening production.
    expect(
      isDevPreviewAllowed({ NODE_ENV: 'production', DEV_PREVIEW: '1' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('treats any value other than "1" as off', () => {
    for (const v of ['0', 'true', 'yes', '', ' 1']) {
      expect(
        isDevPreviewAllowed({ NODE_ENV: 'production', DEV_PREVIEW: v } as NodeJS.ProcessEnv),
      ).toBe(false);
    }
  });

  it('the gate is a layout, and is force-dynamic', () => {
    const layout = read('app/dev/layout.tsx');
    expect(layout).toContain('isDevPreviewAllowed');
    expect(layout).toContain('notFound()');
    // Without this the gate is evaluated once at `next build`, with the
    // BUILDER's env, and baked into the image with s-maxage=31536000 — the
    // exact failure the /design gate records having shipped.
    expect(layout).toMatch(/export const dynamic\s*=\s*'force-dynamic'/);
  });
});

describe('/docs is deindexed (D-B)', () => {
  it('declares robots.index = false', () => {
    expect(read('app/docs/page.tsx')).toMatch(/robots:\s*\{[^}]*index:\s*false/);
  });

  it('is absent from the sitemap — a sitemap row and a noindex contradict', () => {
    const sitemap = read('app/sitemap.ts');
    // Only the explanatory comment may mention it; no route entry may.
    expect(sitemap).not.toMatch(/\{\s*path:\s*'\/docs'/);
  });

  it('still renders — deindexed is not retired', () => {
    // The ruling was noindex + unlink, explicitly NOT a retirement. If someone
    // later deletes the page, this fails and they have to make that call openly.
    expect(() => read('app/docs/page.tsx')).not.toThrow();
  });
});
