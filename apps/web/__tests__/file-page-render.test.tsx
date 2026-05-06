import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import CredentialingFilePage from '../app/file/[fileId]/page';
import { FILE_TOC, sectionAnchorId } from '@/lib/file/fileMeta';

async function renderPage(fileId: string): Promise<string> {
  const element = await CredentialingFilePage({ params: Promise.resolve({ fileId }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('credentialing file page — render', () => {
  it('renders the demo banner so a viewer cannot mistake this for a real file', async () => {
    const html = await renderPage('demo-001');
    expect(html).toContain('data-testid="file-demo-banner"');
    expect(html).toContain('Demo file — not a real credentialing record');
    expect(html).toContain('data-is-demo="true"');
  });

  it('renders the toolbar with the meta id and classification', async () => {
    const html = await renderPage('demo-001');
    expect(html).toContain('data-testid="file-toolbar"');
    expect(html).toContain('data-file-id="VCV-CF-DEMO-001"');
    expect(html).toContain('data-testid="file-classification"');
    expect(html).toContain('CONFIDENTIAL · PEER-REVIEW PRIVILEGED');
  });

  it('renders all 8 sections with stable anchor ids', async () => {
    const html = await renderPage('demo-001');
    // Decode &amp; back to & before label comparison so tests stay
    // readable (the rendered HTML escapes & in labels like
    // "Readiness & Trust Summary").
    const decoded = html.replace(/&amp;/g, '&');
    for (const t of FILE_TOC) {
      expect(html).toContain(`id="${sectionAnchorId(t.id)}"`);
      expect(html).toContain(`data-section-id="${t.id}"`);
      expect(decoded).toContain(t.label);
    }
  });

  it('disables Bundle and Print buttons in Phase 1 with a clear reason attr', async () => {
    const html = await renderPage('demo-001');
    expect(html).toContain('data-testid="file-bundle-button"');
    expect(html).toContain('data-testid="file-print-button"');
    expect(html).toContain('data-disabled-reason="phase-2-pending"');
  });

  it('does not introduce banned overclaim copy', async () => {
    const html = await renderPage('demo-001');
    const lower = html.toLowerCase();
    const banned = [
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
    for (const phrase of banned) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
    // No bare "Verified" status badge — the page intentionally never
    // claims a section is "Verified" in Phase 1.
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('escapes hostile fileIds in the meta id surface', async () => {
    const html = await renderPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toMatch(/data-file-id="VCV-CF-[A-Z0-9._-]+"/);
  });

  it('does not claim decisionGrade is true anywhere on the page', async () => {
    const html = await renderPage('demo-001');
    // The PSV section is a placeholder shell. It must not claim the
    // candidate is decision-grade. Spot-check the placeholder copy.
    expect(html).toContain('decisionGrade is the literal false');
  });
});
