import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div>Mock Clerk Sign Up</div>,
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

describe('/sign-up page', () => {
  it('explains the holder value in plain language before account creation', async () => {
    const { default: SignUpPage } = await import('../app/sign-up/[[...sign-up]]/page');
    const markup = renderToStaticMarkup(<SignUpPage />);

    expect(markup).toContain('Build one clinician record you can keep using.');
    expect(markup).toContain('Upload once');
    expect(markup).toContain('See what changed');
    expect(markup).toContain('Move into passport and apply');
    expect(markup).toContain('from sign up to upload, readiness, passport, sharing, and applications');
    expect(markup).toContain('Mock Clerk Sign Up');
  });
});
