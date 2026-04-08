import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/documents/DocumentParser', () => ({
  DocumentParser: () => <div>Mock Document Parser</div>,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname ?? '#'} {...props}>
      {children}
    </a>
  ),
}));

describe('/documents page', () => {
  it('frames upload as part of the holder loop instead of a detached parser tool', async () => {
    const { default: DocumentsPage } = await import('../app/documents/page');
    const markup = renderToStaticMarkup(<DocumentsPage />);

    expect(markup).toContain('Upload CV or credential evidence');
    expect(markup).toContain('same clinician record VitalCV uses for your passport, readiness, employer shares, and applications');
    expect(markup).toContain('Stored on your profile');
    expect(markup).toContain('Parsed into state');
    expect(markup).toContain('Used everywhere next');
    expect(markup).toContain('Return to passport');
    expect(markup).toContain('Review readiness');
    expect(markup).toContain('Mock Document Parser');
  });
});
