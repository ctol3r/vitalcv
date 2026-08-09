/**
 * axe WCAG 2.2 AA over components that actually ship.
 *
 * ── What this replaces, and why ──────────────────────────────────────────
 * This file supersedes `hero-routes.test.tsx`, which was wired to the required
 * `axe WCAG 2.2 AA` status check and ran axe against **five hand-written HTML
 * fixtures**. Its own header said so — "These are NOT full page renders" — but
 * it labelled each one with a route (`axe WCAG 2.2 AA: /clinician/profile`), so
 * the check reported route coverage it never had.
 *
 * By 2026-08-09 the fixtures had drifted off the product entirely:
 *
 *   - `HomeFixture` asserted an <h1> of "Credentialing visibility for the
 *     people who move healthcare" — a string that appears ZERO times on the
 *     live homepage.
 *   - Three of the five named routes (`/clinician/profile`,
 *     `/employer/dashboard`, `/passport/[id]`) are auth-gated or retired, so no
 *     anonymous visitor can reach the thing being "tested".
 *
 * Meanwhile the page audit measured, on the real product: 716 sub-44px touch
 * targets, two public pages with no <h1>, three with two. All EC-5 violations.
 * All green through this gate, because a fixture cannot fail for the page.
 *
 * ── The two honest layers ────────────────────────────────────────────────
 * ROUTES are now covered by `tests/e2e/a11y-public-routes.spec.ts`, which runs
 * axe against rendered pages in the already-required `Web E2E (Playwright)`
 * job, ratcheted per route.
 *
 * COMPONENTS are covered here — real exported components rendered by React, not
 * markup written to resemble them. A component passing in isolation is a true
 * and useful claim; it is simply a different claim from "the page is
 * accessible", and this file no longer conflates the two.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { runAxeOnHtml } from './axe-runner';

// RouteTrail and ProductChrome are client components that read the pathname.
// Mocking the hook lets the REAL component render; it does not stand in for the
// component the way a fixture would.
vi.mock('next/navigation', () => ({
  usePathname: () => '/employer/review/app-4471',
}));

import { RouteTrail } from '@/components/navigation/RouteTrail';
import { ProductChrome } from '@/components/navigation/ProductChrome';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { ProvenanceChipLegend } from '@/design-system/components';

// Accepted at foundation tier; each needs a row in
// docs/security/a11y-known-violations.md with justification + planned wave.
// color-contrast is measured against the design-system token audit
// (Wave DS-contrast-1) and cannot be resolved component-by-component.
const KNOWN_VIOLATION_IDS: ReadonlySet<string> = new Set(['color-contrast']);

const CASES: [string, React.ReactElement][] = [
  ['RouteTrail (breadcrumb)', <RouteTrail key="t" />],
  ['ProductChrome (signed-in bar + trail)', <ProductChrome key="c" />],
  [
    'TrustStateCard (terminal state, heading promoted)',
    <TrustStateCard
      key="s"
      eyebrow="Employer review"
      titleAs="h1"
      title="Review link unavailable"
      description="This review link is missing, expired, or no longer maps to an active packet."
      tone="warning"
      centered
    />,
  ],
  ['ProvenanceChipLegend (the state register)', <ProvenanceChipLegend key="l" rows="all" />],
];

for (const [label, element] of CASES) {
  describe(`axe WCAG 2.2 AA — ${label}`, () => {
    it('has no unwhitelisted violations', async () => {
      const html = renderToStaticMarkup(element);

      // A component that renders nothing cannot fail an a11y check, and would
      // make this suite quietly vacuous — the exact failure mode being fixed.
      expect(html.length, `${label} rendered no markup`).toBeGreaterThan(0);

      const violations = (await runAxeOnHtml(html, label)).filter(
        (v) => !KNOWN_VIOLATION_IDS.has(v.id),
      );

      if (violations.length > 0) {
        const detail = violations
          .map(
            (v) =>
              `[${v.id}] ${v.description} — ${v.nodes.map((n) => n.target.join(', ')).join('; ')}`,
          )
          .join('\n');
        throw new Error(
          `Unwhitelisted axe violations in ${label}:\n${detail}\n` +
            'Fix the component, or add a justified row to docs/security/a11y-known-violations.md.',
        );
      }
      expect(violations).toHaveLength(0);
    });
  });
}
