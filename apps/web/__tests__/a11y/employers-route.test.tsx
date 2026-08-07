import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EmployersPage from '@/app/employers/page';
import { runAxeOnHtml } from './axe-runner';

/**
 * axe WCAG 2.2 AA for /employers — run against the REAL page export.
 *
 * `hero-routes.test.tsx` scans hand-written fixtures that approximate each route.
 * Fixtures cannot catch a violation introduced in the actual page, so they pass
 * whether or not the shipped surface is accessible — the same class of blind spot
 * as a guard that names a component instead of a route. This renders the route
 * itself, so a regression in the page fails the build.
 *
 * Added with the MB1 audience section, which introduces the page's first
 * heading-level nesting below h2 and its first in-card anchors.
 */
describe('axe WCAG 2.2 AA: /employers (real page export)', () => {
  it('has no WCAG 2.2 AA violations', async () => {
    const html = renderToStaticMarkup(<EmployersPage />);
    const violations = await runAxeOnHtml(html, '/employers');

    expect(
      violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.failureSummary ?? ''}`),
    ).toEqual([]);
  });

  it('keeps a single h1 and a non-skipping heading order', async () => {
    const html = renderToStaticMarkup(<EmployersPage />);
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);

    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });
});
