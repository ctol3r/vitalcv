// @vitest-environment jsdom

/**
 * Truth contract: the signed-in clinician's credential wallet.
 *
 * CredentialWallet renders on /holder, an authenticated surface, so anything it
 * shows reads as the viewing clinician's own credentials. It once fell back to a
 * hardcoded DEMO_ROWS constant whenever the wallet API was unreachable — and
 * suppressed the error — so an outage silently presented three invented
 * credentials, including a REVOKED DEA registration, under NPI 1003000126, which
 * is check-digit-valid and belongs to a real physician.
 *
 * These tests assert the outcome (no credential the API did not return ever
 * reaches the screen, and an outage is stated) rather than the mechanism, so a
 * different-but-honest implementation still passes.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialWallet } from '../components/wallet/CredentialWallet';

/** Every fabricated value the removed fallback used to render. */
const FABRICATED_STRINGS = ['CA-8821', 'ABIM-4422', 'BD1234567', '1003000126'];

const HOLDER_NPI = '1234567890';

let container: HTMLDivElement;
let root: Root;

async function render(node: React.ReactElement): Promise<void> {
  await act(async () => {
    root.render(node);
  });
}

beforeEach(() => {
  // Components are compiled with the classic JSX transform under this config.
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CredentialWallet under a wallet-API outage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network unreachable');
    }));
  });

  it('renders no credentials at all', async () => {
    await render(<CredentialWallet subject={HOLDER_NPI} />);

    // A rendered credential row always carries a status badge; none may exist.
    for (const status of ['ACTIVE', 'REVOKED', 'EXPIRED', 'SUSPENDED']) {
      expect(container.textContent).not.toContain(status);
    }
  });

  it('never substitutes the fabricated demo credentials', async () => {
    await render(<CredentialWallet subject={HOLDER_NPI} />);

    for (const fabricated of FABRICATED_STRINGS) {
      expect(container.textContent).not.toContain(fabricated);
    }
  });

  it('states that the wallet is unavailable instead of suppressing the error', async () => {
    await render(<CredentialWallet subject={HOLDER_NPI} />);

    expect(container.textContent?.toLowerCase()).toContain('unavailable');
  });

  it('offers a retry that re-requests the wallet', async () => {
    await render(<CredentialWallet subject={HOLDER_NPI} />);

    const retry = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.toLowerCase().includes('retry'));
    expect(retry).toBeDefined();

    const callsBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      retry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBeGreaterThan(callsBefore);
  });
});

describe('CredentialWallet source of truth', () => {
  it('renders only what the wallet API returned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        subject: HOLDER_NPI,
        credentials: [
          {
            credential: {
              credentialId: 'cred-from-api',
              issuer: 'did:vitalcv:issuer:example-board',
              subject: HOLDER_NPI,
              claims: { licenseNumber: 'API-RETURNED-VALUE' },
              status: 'ACTIVE',
              issuedAt: '2026-01-01T00:00:00Z',
              schemaVersion: '1.0',
            },
            daysUntilExpiry: null,
            expiryWarning: 'none',
          },
        ],
        summary: { subject: HOLDER_NPI, total: 1, active: 1, expiring: 0, expired: 0, revoked: 0 },
      }),
    })));

    await render(<CredentialWallet subject={HOLDER_NPI} />);

    expect(container.textContent).toContain('API-RETURNED-VALUE');
    for (const fabricated of FABRICATED_STRINGS) {
      expect(container.textContent).not.toContain(fabricated);
    }
  });
});
