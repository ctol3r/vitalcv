/**
 * directory-provider-page.test.ts — the public, indexable provider page.
 *
 * This page is the one surface built to be found by a search engine, which
 * makes it the one surface a reader arrives at with NO surrounding context.
 * The rules that matter here are therefore about what it must NOT imply.
 *
 * The route itself is exercised end-to-end against live CMS in a browser;
 * these tests pin the contracts a browser check cannot enforce over time.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIRECTORY_CONTEXT_NOTE } from '@/lib/clinician-record/copy';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'app/directory/[npi]/page.tsx'),
  'utf8',
);

describe('structured data', () => {
  it('never emits the self-reported credential as a schema.org credential', () => {
    // hasCredential / award would let a search engine render an unverified,
    // self-reported string as a verified attribute of the person. The
    // credential text is shown on the page, clearly labelled — it must not
    // also be machine-published as a qualification.
    expect(SOURCE).not.toContain('hasCredential');
    expect(SOURCE).not.toContain('"award"');
  });

  it('publishes the NPI as an identifier rather than a claim', () => {
    expect(SOURCE).toContain("propertyID: 'NPI'");
  });
});

describe('indexing posture', () => {
  it('declares a canonical URL so the verifier view is not treated as a duplicate', () => {
    expect(SOURCE).toContain('alternates');
    expect(SOURCE).toContain('canonical');
  });

  it('does not let an unreadable record be indexed', () => {
    // When CMS gives nothing back, generateMetadata marks the page noindex
    // rather than letting an empty provider page into the index.
    expect(SOURCE).toContain('index: false');
  });

  it('caches rather than refetching CMS per request', () => {
    // An indexable page that hits CMS on every crawl makes indexing depend on
    // a third party being up at crawl time.
    expect(SOURCE).toContain('export const revalidate');
  });
});

describe('honesty framing', () => {
  it('states what the page is not, before the data', () => {
    // Asserted against the constant, not the JSX. Prose inlined in a
    // component wraps across lines, so a source grep for a phrase silently
    // stops matching the moment the formatter reflows it.
    expect(DIRECTORY_CONTEXT_NOTE).toMatch(/not a background check/i);
    expect(DIRECTORY_CONTEXT_NOTE).toMatch(/licence check|license check/i);
    expect(DIRECTORY_CONTEXT_NOTE).toMatch(/does not confirm these details/i);
    // And it is actually rendered, not merely defined.
    expect(SOURCE).toContain('DIRECTORY_CONTEXT_NOTE');
  });

  it('rejects a malformed NPI instead of rendering a shell', () => {
    expect(SOURCE).toContain('/^\\d{10}$/.test(npi)');
    expect(SOURCE).toContain('notFound()');
  });

  it('carries none of the banned truth-contract phrases', () => {
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'complete credentialing',
      'instant credentialing',
      'legally accepted',
      'risk transferred',
      'certified compliant',
      'HIPAA compliant',
      'SOC2 certified',
    ];
    const lower = (SOURCE + DIRECTORY_CONTEXT_NOTE).toLowerCase();
    for (const phrase of banned) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('shared record path', () => {
  it('renders the same record component as the verifier view', () => {
    // Two provider pages built on two data paths is how they end up
    // disagreeing about the same person.
    expect(SOURCE).toContain('ClinicianRecordDetail');
    expect(SOURCE).toContain('buildClinicianRecord');
  });
});
