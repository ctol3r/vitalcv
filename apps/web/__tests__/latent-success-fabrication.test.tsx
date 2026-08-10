/**
 * No-fabricated-outcome contract — the two LATENT carriers.
 *
 * #1277 removed the live instance (an employer authorization denial rendered
 * as "Request recorded"). A sweep for the same shape found two more, both
 * currently unreachable:
 *
 *   - `feedback/NpsModal` — zero references anywhere in the app.
 *   - `evidence/EvidenceViewer` — reachable only from pages under
 *     `app/_archive/`, which the build does not emit as routes (verified
 *     against `.next/routes-manifest.json`: no `/intelligence` page route).
 *
 * Unreachable is not fixed. Both sat behind one import away from shipping a
 * false "recorded" / "received" claim, so the contract is pinned here rather
 * than left to whoever remounts them.
 *
 * These assert the SOURCE of each component, deliberately. Rendering them
 * would test the branch; reading them tests that no path through the function
 * can reach the success state without an `ok` response — which is the actual
 * contract, and the thing that regressed in #1277.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const NPS = 'components/feedback/NpsModal.tsx';
const VIEWER = 'components/evidence/EvidenceViewer.tsx';

describe('NpsModal — "Message received" requires the server to have received it', () => {
  const src = read(NPS);

  it('checks response.ok before claiming receipt', () => {
    expect(src).toMatch(/ok\s*=\s*response\.ok/);
  });

  it('never reaches the success screen on a failed or thrown request', () => {
    // The success setter must be guarded by the ok flag. A bare
    // `setSubmitted(true)` after a swallowed catch is the exact regression.
    expect(src).toMatch(/if\s*\(!ok\)\s*\{[\s\S]*?setFailed\(true\)[\s\S]*?return;[\s\S]*?\}/);
    const afterGuard = src.slice(src.indexOf('if (!ok)'));
    expect(afterGuard).toContain('setSubmitted(true)');
  });

  it('tells the person nothing was recorded when it fails', () => {
    expect(src).toContain('Nothing was recorded.');
  });

  it('does not swallow the failure silently', () => {
    expect(src).not.toMatch(/catch\s*\{\s*\/\*\s*best-effort\s*\*\/\s*\}/);
  });
});

describe('EvidenceViewer — "quality recorded" requires a recorded quality', () => {
  const src = read(VIEWER);

  it('checks response.ok before marking the rating submitted', () => {
    expect(src).toMatch(/if\s*\(!response\.ok\)\s*\{[\s\S]*?setSubmitFailed\(true\)[\s\S]*?return;/);
  });

  it('surfaces a thrown request instead of failing silently', () => {
    // The old comment justified silence ("the surrounding workbench already
    // exposes the action state"); it did not, and silence reads as success.
    expect(src).not.toContain('Intentionally silent');
    expect(src).toMatch(/catch\s*\{[\s\S]{0,400}?setSubmitFailed\(true\)/);
  });

  it('states plainly that nothing was recorded', () => {
    expect(src).toContain('Not recorded');
  });

  it('resets the failure flag when a new attempt starts', () => {
    // Otherwise a retry shows the stale failure alongside a fresh success.
    expect(src).toMatch(/setSubmitting\(true\);\s*\n\s*setSubmitFailed\(false\);/);
  });
});
