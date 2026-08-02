import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EmployersPage from '@/app/employers/page';
import { EMPLOYER_STAGES } from '@/components/employers/employerWorkflow';
import { EMPLOYER_ORG_SIZES } from '@/components/employers/employerAudience';

/**
 * Organization access is REQUESTED, never claimed.
 *
 * Resolving a Type 2 NPI in NPPES establishes which organization is meant. It
 * is not authority to act for that organization, and the server refuses on
 * exactly that basis (`resolveOrganizationAuthority` — a work email at the
 * organization's own domain, else manual review). "Claim your organization"
 * promised an entitlement the platform does not grant on an NPI, so the copy
 * has to ask rather than announce.
 *
 * Asserted against the RENDERED ROUTE and the shipped source, not against the
 * components by name: a guard naming a component goes quietly green the moment
 * the page stops rendering it.
 */

const markup = renderToStaticMarkup(<EmployersPage />);
const text = markup
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&rsquo;|&#x27;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

describe('/employers asks for access instead of offering a claim', () => {
  it('offers the request, at the top and at step 1', () => {
    expect(text).toContain('Request organization access');
    expect(text).toContain('Step 1 — Request organization access');
  });

  it('has no "claim your organization" call to action anywhere on the route', () => {
    expect(text.toLowerCase()).not.toContain('claim your organization');
    expect(text.toLowerCase()).not.toContain('claim this organization');
  });

  it('anchors the step to the request id, and drops the claim id', () => {
    expect(markup).toContain('id="request-organization-access"');
    expect(markup).toContain('href="#request-organization-access"');
    expect(markup).not.toContain('claim-your-organization');
  });

  it('states that NPPES resolution is not authority', () => {
    // The substance behind the rename: the boundary has to survive, not just
    // the verb. Phrasing may change; "not authority to act for it" is the claim.
    expect(text.toLowerCase()).toContain('not authority to act for it');
  });
});

describe('the workflow and audience data agree with the route', () => {
  it('stage 01 is the access request, with its boundary intact', () => {
    const first = EMPLOYER_STAGES[0];
    expect(first.title).toBe('Request organization access');
    expect(first.boundary?.toLowerCase()).toContain('not authority to act for it');
    expect(first.title.toLowerCase()).not.toContain('claim');
  });

  it('every self-serve band points at the request anchor', () => {
    const selfServe = EMPLOYER_ORG_SIZES.filter((b) => b.action.href.startsWith('#'));
    expect(selfServe.length).toBeGreaterThan(0);
    for (const band of selfServe) {
      expect(band.action.href).toBe('#request-organization-access');
      expect(band.action.label).toBe('Request organization access');
    }
  });
});

/**
 * Source sweep. The rendered route only proves the surfaces this test renders;
 * the phrase could survive in a component reached from another page (it did —
 * EmployerProfileSurface, on /employer/profile). Scan what actually ships.
 */
describe('no active surface still says "claim your organization"', () => {
  const roots = [join(__dirname, '..', 'app'), join(__dirname, '..', 'components')];
  const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '_archive', 'dist']);

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(abs, out);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(abs);
      }
    }
    return out;
  }

  const files = roots.flatMap((r) => walk(r));

  it('scans a real, non-empty file set', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('finds the phrase in no shipped app or component source', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      // Strip comments: the doc comments deliberately record the retired
      // phrasing and why it went. Prose about the ban is not the ban's target.
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      // Every grammatical form, not just the CTA string. The narrow version of
      // this regex passed while EmployerWorkflowPreview still headlined "From
      // claiming your organization to a clinician's first day" — the rendered
      // route is what caught it, so the sweep now matches the inflections too.
      if (/claim(s|ed|ing)?\s+(your|this|their|the)\s+organization/i.test(code)) {
        offenders.push(file.slice(file.indexOf('/apps/web/') + 1));
      }
    }
    expect(offenders, `still offering an organization claim:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
