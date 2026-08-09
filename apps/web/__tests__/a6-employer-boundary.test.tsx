/**
 * a6-employer-boundary.test.tsx — A6 (employer acquisition + Trust).
 *
 * The audit's A6 gate: no claim anywhere that a packet equals credentialing,
 * privileging, hiring, or an automatic start — and the boundary language that
 * makes the employer the decider must keep rendering. This copy is exactly
 * the kind that "polish" passes have dropped before (the repo's recorded
 * failure mode), so the boundary is pinned as a rendered-output contract,
 * not a style guideline.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import EmployersPage from '../app/employers/page';
import TrustPage from '../app/trust/page';

async function render(node: ReactElement | Promise<ReactElement>): Promise<string> {
  return renderToStaticMarkup(await node);
}

/** Claims that would equate a packet with a hiring/credentialing outcome. */
const EQUATING_CLAIMS =
  /automatic start|hire instantly|instantly credential|credentialing (is )?(complete|done|finished)|pre-?approved to start|guaranteed (hire|start)/i;

describe('the employer-decision boundary keeps rendering', () => {
  it('/employers says the decision stays with the employer, and never equates a packet with an outcome', async () => {
    const html = await render(EmployersPage() as ReactElement | Promise<ReactElement>);
    expect(html).toContain('decision stays yours');
    expect(html).not.toMatch(EQUATING_CLAIMS);
  });

  it('/trust keeps its non-credentialing clauses in their own words', async () => {
    const html = await render(TrustPage() as ReactElement | Promise<ReactElement>);
    expect(html).toContain('It does not credential, privilege, or clear anyone.');
    expect(html).toContain('final credentialing decision always belongs to the employer');
    expect(html).toContain('A source-backed identity is not a completed credentialing decision.');
    expect(html).not.toMatch(EQUATING_CLAIMS);
  });
});
