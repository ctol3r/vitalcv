/**
 * A11Y-AXE-2: real axe-core WCAG 2.2 AA gate on top of the JSDOM baseline
 * established in A11Y-AXE-1 (PR #229).
 *
 * Each route is represented as static HTML rendered via React's
 * renderToStaticMarkup — no Next dev server, no DB calls.
 *
 * Unwhitelisted violations fail the build.
 * Accepted violations are documented in docs/security/a11y-known-violations.md.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { runAxeOnHtml, type AxeViolation } from './axe-runner';

// Violation IDs accepted at foundation tier (each must have a row in
// docs/security/a11y-known-violations.md with justification + planned fix wave).
const KNOWN_VIOLATION_IDS: ReadonlySet<string> = new Set([
  // color-contrast: design system token audit is tracked in Wave DS-contrast-1.
  'color-contrast',
]);

function filterUnwhitelisted(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter((v) => !KNOWN_VIOLATION_IDS.has(v.id));
}

// ---------------------------------------------------------------------------
// Route fixtures: representative structural HTML for each hero route.
// These are NOT full page renders — they capture the landmark/heading/form
// skeleton that axe evaluates for WCAG 2.2 AA compliance.
// ---------------------------------------------------------------------------

function HomeFixture(): React.ReactElement {
  return (
    <div>
      <nav aria-label="Main navigation">
        <a href="/">VitalCV</a>
        <a href="/pilot">Start Pilot</a>
        <a href="/employer/dashboard">Employer</a>
      </nav>
      <main>
        <h1>Credentialing visibility for the people who move healthcare</h1>
        <p>
          VitalCV surfaces source-backed evidence about clinician readiness before hire
          decisions lock in.
        </p>
        <a href="/pilot" aria-label="Request pilot access — opens pilot intake form">
          Request pilot access
        </a>
      </main>
      <footer>
        <p>VitalCV — source-backed credential evidence</p>
      </footer>
    </div>
  );
}

function PilotFixture(): React.ReactElement {
  return (
    <div>
      <nav aria-label="Main navigation">
        <a href="/">VitalCV</a>
      </nav>
      <main>
        <h1>Start a Pilot</h1>
        <p>
          A 30-day focused employer pilot measuring startability timeline events against
          your current workflow on 10–30 real clinician NPIs.
        </p>
        <form aria-label="Pilot intake request">
          <div>
            <label htmlFor="org-name">Organization name</label>
            <input id="org-name" type="text" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor="contact-name">Contact name</label>
            <input id="contact-name" type="text" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="contact-email">Work email</label>
            <input id="contact-email" type="email" autoComplete="email" />
          </div>
          <button type="submit">Request pilot</button>
        </form>
      </main>
    </div>
  );
}

function ClinicianProfileFixture(): React.ReactElement {
  return (
    <div>
      <nav aria-label="Main navigation">
        <a href="/">VitalCV</a>
      </nav>
      <main>
        <h1>Clinician Profile</h1>
        <section aria-labelledby="license-heading">
          <h2 id="license-heading">License status</h2>
          <p>Source-backed evidence of state medical licensure registered against NPPES.</p>
          <span aria-label="License status: source-backed">Source-backed</span>
        </section>
        <section aria-labelledby="exclusion-heading">
          <h2 id="exclusion-heading">Exclusion check</h2>
          <p>OIG LEIE federal exclusion scope only; state Medicaid exclusion lists tracked separately.</p>
        </section>
      </main>
    </div>
  );
}

function PassportFixture(): React.ReactElement {
  return (
    <div>
      <nav aria-label="Main navigation">
        <a href="/">VitalCV</a>
      </nav>
      <main>
        <h1>Credential Passport</h1>
        <section aria-labelledby="trust-tier-heading">
          <h2 id="trust-tier-heading">Source coverage</h2>
          <p>Evidence tier based on primary-source verification coverage. Not a compliance certification.</p>
        </section>
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Verification timeline</h2>
          <p>Submission to first-action timeline. Limitation notes attached where source coverage is incomplete.</p>
        </section>
      </main>
    </div>
  );
}

function EmployerDashboardFixture(): React.ReactElement {
  return (
    <div>
      <nav aria-label="Main navigation">
        <a href="/">VitalCV</a>
        <a href="/employer/dashboard" aria-current="page">Dashboard</a>
      </nav>
      <main>
        <h1>Employer Dashboard</h1>
        <section aria-labelledby="active-heading">
          <h2 id="active-heading">Active requests</h2>
          <p>Review in-progress credential verification requests.</p>
        </section>
        <section aria-labelledby="completed-heading">
          <h2 id="completed-heading">Completed</h2>
          <p>Finalized verification packets available for committee review.</p>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ROUTE_FIXTURES: [string, React.ReactElement][] = [
  ['/', React.createElement(HomeFixture)],
  ['/pilot', React.createElement(PilotFixture)],
  ['/clinician/profile', React.createElement(ClinicianProfileFixture)],
  ['/passport/[id]', React.createElement(PassportFixture)],
  ['/employer/dashboard', React.createElement(EmployerDashboardFixture)],
];

for (const [route, fixture] of ROUTE_FIXTURES) {
  describe(`axe WCAG 2.2 AA: ${route}`, () => {
    it('has no unwhitelisted violations', async () => {
      const html = renderToStaticMarkup(fixture);
      const violations = await runAxeOnHtml(html, route);
      const unwhitelisted = filterUnwhitelisted(violations);
      if (unwhitelisted.length > 0) {
        const detail = unwhitelisted
          .map((v) => `[${v.id}] ${v.description} — ${v.nodes.map((n) => n.target.join(', ')).join('; ')}`)
          .join('\n');
        throw new Error(`Unwhitelisted axe violations on ${route}:\n${detail}\nAdd to docs/security/a11y-known-violations.md with justification.`);
      }
      expect(unwhitelisted).toHaveLength(0);
    });
  });
}
