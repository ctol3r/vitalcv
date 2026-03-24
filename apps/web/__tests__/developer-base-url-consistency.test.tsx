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

const TEST_API_BASE = 'https://branch-api.vitalcv.test';

describe('developer base URL consistency', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('BACKEND_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_BASE', TEST_API_BASE);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the configured public API base aligned across developer surfaces', async () => {
    const { buildApiReferenceUrls, buildWebhookSubscribeExample } = await import('../lib/developers/public-api-reference');
    const { ApiSandbox } = await import('../components/developers/ApiSandbox');
    const { SdkDocs } = await import('../components/developers/SdkDocs');
    const { getPublicApiHostLabel } = await import('../lib/api');

    expect(getPublicApiHostLabel()).toBe('branch-api.vitalcv.test');
    expect(buildApiReferenceUrls().baseUrl).toBe(TEST_API_BASE);
    expect(buildWebhookSubscribeExample()).toContain(`${TEST_API_BASE}/api/network/webhooks/register`);

    const sandboxMarkup = renderToStaticMarkup(<ApiSandbox />);
    const sdkMarkup = renderToStaticMarkup(<SdkDocs />);

    expect(sandboxMarkup).toContain(`${TEST_API_BASE}/api/public/profile/npi/1234567890`);
    expect(sdkMarkup).toContain(TEST_API_BASE);
    expect(sandboxMarkup).not.toContain('https://api.vitalcv.com');
    expect(sdkMarkup).not.toContain('https://api.vitalcv.com');
  });
});
