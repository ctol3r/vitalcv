/**
 * homepage-main-landmark.test.tsx
 *
 * Closes the Browser-discovered a11y bug: the homepage rendered no
 * <main> landmark, so the chrome's "Skip to content" link landed on a
 * <div> with id="main-content" instead of a real landmark element.
 *
 * Truth contract:
 *   - HomePageClient must render a <main id="main-content"> wrapping
 *     the primary content.
 *   - The skip-link target ("#main-content") in RootChrome must match
 *     the id rendered by the homepage. (Pure source-grep — no DOM render
 *     needed; HomePageClient is a 'use client' component with hooks
 *     that are awkward to render in vitest's node environment.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HOMEPAGE_PATH = resolve(__dirname, '../app/HomePageClient.tsx');
const ROOT_CHROME_PATH = resolve(__dirname, '../components/layout/RootChrome.tsx');

describe('homepage <main> landmark', () => {
  it('HomePageClient renders <main id="main-content"> and skip link target matches', () => {
    const homepage = readFileSync(HOMEPAGE_PATH, 'utf-8');
    const chrome = readFileSync(ROOT_CHROME_PATH, 'utf-8');

    // The fix: top-level wrapper is <main id="main-content"> not <div>
    expect(homepage).toMatch(/<main\s+id="main-content"/);
    // And it must close as </main> at the end (no orphan <main> tag)
    expect(homepage).toMatch(/<\/main>\s*\)?\s*;?\s*\}?\s*$/m);

    // The chrome's skip link must point at #main-content — the id the
    // homepage now exposes on a real landmark.
    const skipLinkMatch = chrome.match(/href="(#[a-z0-9_-]+)"[^>]*>\s*Skip to content/i);
    expect(skipLinkMatch, 'RootChrome must contain a "Skip to content" link with an href').not.toBeNull();
    expect(skipLinkMatch![1]).toBe('#main-content');
  });
});
