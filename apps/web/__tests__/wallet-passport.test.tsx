// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletPassport } from '@/components/wallet/WalletPassport';

const { fetchMock, trackClinicianEventOncePerSessionMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  trackClinicianEventOncePerSessionMock: vi.fn(),
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

vi.mock('@/lib/mobile/analytics', () => ({
  trackClinicianEventOncePerSession: trackClinicianEventOncePerSessionMock,
}));

vi.mock('@/components/pilot-ops/PilotFailureSignal', () => ({
  PilotFailureSignal: () => null,
}));

vi.mock('@/components/pilot-ops/SupportActionButton', () => ({
  SupportActionButton: () => null,
}));

vi.mock('@/components/trust-state/MonitoringStatusBadge', () => ({
  MonitoringStatusBadge: () => <div>Monitoring active</div>,
}));

vi.mock('@/components/trust-state/SanctionRiskBadge', () => ({
  SanctionRiskBadge: ({ label }: { label: string }) => <div>{label}</div>,
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

describe('WalletPassport', () => {
  afterEach(() => {
    fetchMock.mockReset();
    trackClinicianEventOncePerSessionMock.mockReset();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  it('keeps holder passport actions connected to readiness, explore, and sharing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        npi: '1234567890',
        identityVerified: true,
        licensureStatus: 'verified',
        exclusionClear: true,
        credentialCount: 4,
        readiness_level: 'L2',
        readiness_status: 'Mostly ready - one blocker left',
        readiness_score: 88,
        gap_summary: ['DEA registration not verified'],
        computed_at: '2026-04-08T09:00:00.000Z',
        facts: [
          {
            factType: 'NPI_IDENTITY',
            source: 'NPPES',
            status: 'VERIFIED',
            verifiedAt: '2026-04-08T09:00:00.000Z',
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const view = await renderNode(
      <WalletPassport npi="1234567890" pollIntervalMs={0} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/trust-state/1234567890', { cache: 'no-store' });
    expect(view.container.textContent).toContain('Your verified clinician record');
    expect(view.container.textContent).toContain('Explore roles');
    expect(view.container.textContent).toContain('Preview shareable passport');
    expect(view.container.textContent).toContain('Use the same clinician record in readiness, explore, and employer sharing');

    await view.unmount();
  });
});
