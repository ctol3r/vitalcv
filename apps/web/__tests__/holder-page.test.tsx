// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
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

vi.mock('@/components/wallet/WalletPassport', () => ({
  WalletPassport: ({ npi }: { npi: string }) => <div>WalletPassport {npi}</div>,
}));

vi.mock('@/components/wallet/CredentialWallet', () => ({
  CredentialWallet: ({ subject }: { subject: string }) => <div>CredentialWallet {subject}</div>,
}));

vi.mock('@/components/clinician/CredentialPresentationActions', () => ({
  CredentialPresentationActions: ({ holderNpi }: { holderNpi: string }) => <div>CredentialPresentationActions {holderNpi}</div>,
}));

vi.mock('@/components/mobile/EvidenceUploadPanel', () => ({
  default: ({ heading, returnToLabel }: { heading: string; returnToLabel: string }) => (
    <div>
      <div>{heading}</div>
      <div>{returnToLabel}</div>
    </div>
  ),
}));

vi.mock('@/components/mobile/ClinicianSupportCard', () => ({
  ClinicianSupportCard: ({ primaryLabel }: { primaryLabel: string }) => <div>{primaryLabel}</div>,
}));

vi.mock('@/components/trust-state/TrustStatePanel', () => ({
  TrustStatePanel: ({ npi }: { npi: string }) => <div>TrustStatePanel {npi}</div>,
}));

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('/holder page', () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  it('keeps the no-npi state connected to onboarding and upload instead of dead-ending', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        personProfile: {
          npi: null,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { default: HolderPage } = await import('../app/holder/page');
    const view = await renderNode(<HolderPage />);

    expect(view.container.textContent).toContain('Set up your clinician record');
    expect(view.container.textContent).toContain('Start with your NPI');
    expect(view.container.textContent).toContain('Upload CV or credential');
    expect(view.container.innerHTML).toContain('href="/get-ready"');
    expect(view.container.innerHTML).toContain('href="/documents"');

    await view.unmount();
  });

  it('renders the holder passport hub with clear next actions into readiness, roles, and applications', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        personProfile: {
          npi: '1234567890',
          firstName: 'Ada',
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { default: HolderPage } = await import('../app/holder/page');
    const view = await renderNode(<HolderPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/me/workspaces');
    expect(view.container.textContent).toContain('Your passport, readiness, and applications all stay connected here');
    expect(view.container.textContent).toContain('Upload evidence');
    expect(view.container.textContent).toContain('Open readiness');
    expect(view.container.textContent).toContain('Explore roles');
    expect(view.container.textContent).toContain('View applications');
    expect(view.container.textContent).toContain('Upload credential evidence');
    expect(view.container.innerHTML).toContain('href="/documents"');
    expect(view.container.innerHTML).toContain('href="/holder/readiness"');
    expect(view.container.innerHTML).toContain('href="/holder/opportunities"');
    expect(view.container.innerHTML).toContain('href="/holder/applications"');

    await view.unmount();
  });
});
