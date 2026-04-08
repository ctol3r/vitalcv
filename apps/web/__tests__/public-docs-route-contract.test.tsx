import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('public docs and developer route behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps docs links inside the live wedge routes', async () => {
    const DocsPage = (await import('../app/docs/page')).default;
    const markup = renderToStaticMarkup(<DocsPage />);

    expect(markup).toContain('href="/developers"');
    expect(markup).toContain('href="/review"');
    expect(markup).toContain('href="/"');
  });

  it('keeps developer CTA links pointed at the real wedge entry points', async () => {
    const DevelopersPage = (await import('../app/developers/page')).default;
    const markup = renderToStaticMarkup(<DevelopersPage />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/review/request"');
    expect(markup).toContain('href="/docs"');
  });
});
