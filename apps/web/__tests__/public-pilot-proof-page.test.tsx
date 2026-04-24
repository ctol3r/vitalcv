import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('public pilot proof page copy', () => {
  it('removes internal lane/status jargon from the public pilot page', async () => {
    const PilotProofPage = (await import('../app/p/[slug]/page')).default;
    const markup = renderToStaticMarkup(await PilotProofPage({
      params: Promise.resolve({ slug: 'norcal-pa-pilot-1' }),
    }));

    expect(markup).toContain('What happened');
    expect(markup).toContain('Proof type');
    expect(markup).toContain('Partial proof');
    expect(markup).toContain('Decision readiness');
    expect(markup).toContain('Time to employer action');
    expect(markup).toContain('Still incomplete in this pilot run');
    expect(markup).toContain('How this page was verified');
    expect(markup).toContain('Evidence record: isv-loop-1776423023956');
    expect(markup).not.toContain('access_required');
    expect(markup).not.toContain('partial_proof_pack');
    expect(markup).not.toContain('GET /api/isv-events/');
    expect(markup).not.toContain('Loop ID:');
  });
});
