import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import InboxPage from '../app/inbox/page';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

function renderInbox(): string {
  const element = InboxPage();
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('inbox page — render', () => {
  it('renders the demo banner', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-demo-banner"');
    expect(html).toContain('Demo intake');
    expect(html).toContain('data-is-demo="true"');
    expect(html).toContain('data-doc-count="5"');
  });

  it('renders the stats strip with all 6 cells', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-stats-strip"');
    for (const id of [
      'stat-docs',
      'stat-processed',
      'stat-classifying',
      'stat-unclassified',
      'stat-extracted',
      'stat-suggestions',
    ]) {
      expect(html).toContain(`data-testid="${id}"`);
    }
  });

  it('renders the dropzone placeholder explicitly disabled for Phase 1', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-dropzone-placeholder"');
    expect(html).toContain('Phase 2');
  });

  it('renders the document list with all 5 demo docs and their states', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-document-list"');
    for (const id of ['doc-001', 'doc-002', 'doc-003', 'doc-004', 'doc-005']) {
      expect(html).toContain(`data-doc-id="${id}"`);
    }
    expect(html).toContain('data-doc-state="processed"');
    expect(html).toContain('data-doc-state="classifying"');
    expect(html).toContain('data-doc-state="unclassified"');
  });

  it('renders document detail panels for processed docs only', () => {
    const html = renderInbox();
    // 3 processed docs => 3 detail panels.
    const matches = html.match(/data-testid="inbox-document-detail"/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('renders provenance badges using the project-safe label "Source-confirmed", not bare "Verified"', () => {
    const html = renderInbox();
    // Legend renders all 5 provenance badges, including source-confirmed.
    expect(html).toContain('Source-confirmed');
    expect(html).toContain('data-provenance-label="Source-confirmed"');
    // Bare "Verified" must not appear as a status label anywhere on the
    // page — neither as a badge label nor as an inline tag.
    expect(html).not.toMatch(/>\s*Verified\s*</);
    expect(html).not.toContain('data-provenance-label="Verified"');
  });

  it('renders suggestions with disabled accept buttons in Phase 1', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-suggestions-section"');
    const acceptButtons = html.match(/data-testid="suggestion-accept-button"/g) ?? [];
    expect(acceptButtons.length).toBe(3);
    expect(html).toContain('data-disabled-reason="phase-2-pending"');
  });

  it('renders the provenance legend with all 5 keys', () => {
    const html = renderInbox();
    expect(html).toContain('data-testid="inbox-provenance-legend"');
    for (const key of ['source_confirmed', 'inferred', 'user_entered', 'unknown', 'contradicted']) {
      expect(html).toContain(`data-provenance-key="${key}"`);
    }
  });

  it('introduces no banned overclaim copy', () => {
    const html = renderInbox();
    const lower = html.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});
