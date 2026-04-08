import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ProfileCompletionPanel from '../components/mobile/ProfileCompletionPanel';
import EvidenceUploadPanel from '../components/mobile/EvidenceUploadPanel';

vi.mock('@/components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
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

describe('holder upload clarity', () => {
  it('explains what happens to a CV after upload', () => {
    const markup = renderToStaticMarkup(
      <ProfileCompletionPanel mode="resume" />,
    );

    expect(markup).toContain('What happens to your CV');
    expect(markup).toContain('We parse profile details now');
    expect(markup).toContain('We store the original file plus the structured profile summary');
    expect(markup).toContain('still require source-backed checks');
    expect(markup).toContain('Upload states you will see');
    expect(markup).toContain('Parsed into profile');
    expect(markup).toContain('Stored on file');
    expect(markup).toContain('Checked by source');
    expect(markup).toContain('Upload CV');
  });

  it('explains what happens to supporting evidence after upload', () => {
    const markup = renderToStaticMarkup(
      <EvidenceUploadPanel />,
    );

    expect(markup).toContain('What happens after upload');
    expect(markup).toContain('The file is stored immediately');
    expect(markup).toContain('stores the attachment and parses it into the matching credential record');
    expect(markup).toContain('Upload states you will see');
    expect(markup).toContain('Stored');
    expect(markup).toContain('Parsed');
    expect(markup).toContain('employers should still rely on the source-check status before treating it as decision-grade');
  });
});
