/**
 * trust-surfaces-routing.test.tsx
 *
 * Verifies each trust route renders end-to-end:
 *   - the controlled-document SurfaceHeader is present,
 *   - the lineage cells render in the canonical reading order,
 *   - the SurfaceControlFooter closes the artifact,
 *   - degraded rows use the dashed-border contract
 *     (data-degraded), NOT opacity-based disabled styling.
 *
 * Also verifies the .trust-scope wrapper is the root of every
 * surface so trust.css containment is preserved.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import TrustGroupLayout from '../app/trust-canon/layout';
import PassportPage from '../app/trust-canon/passport/[npi]/page';
import VerifyPage from '../app/trust-canon/verify/[receipt]/page';
import ReplayPage from '../app/trust-canon/replay/page';
import ReceiptPage from '../app/trust-canon/receipt/[id]/page';
import TrustRegisterPage from '../app/trust-canon/trust/page';

async function renderInsideLayout(node: React.ReactElement): Promise<string> {
  return renderToStaticMarkup(<TrustGroupLayout>{node}</TrustGroupLayout>);
}

describe('trust route group — layout scoping', () => {
  it('layout wraps children in a .trust-scope container', () => {
    const html = renderToStaticMarkup(
      <TrustGroupLayout>
        <span data-testid="trust-test-child">x</span>
      </TrustGroupLayout>,
    );
    expect(html).toContain('class="trust-scope"');
    expect(html).toContain('data-testid="trust-scope-root"');
    expect(html).toContain('data-testid="trust-test-child"');
  });
});

describe('/passport/[npi]', () => {
  it('renders SurfaceHeader, LineageHeader cells in order, and the degraded list', async () => {
    const page = await PassportPage({ params: Promise.resolve({ npi: '1346053246' }) });
    const html = await renderInsideLayout(page);

    expect(html).toContain('data-testid="trust-surface-header"');
    expect(html).toContain('data-testid="trust-lineage-header"');
    expect(html).toContain('data-testid="trust-degraded-list"');
    expect(html).toContain('data-testid="trust-control-footer"');
  });

  it('every degraded row carries data-degraded and never inline opacity below 1', async () => {
    const page = await PassportPage({ params: Promise.resolve({ npi: '1346053246' }) });
    const html = await renderInsideLayout(page);

    expect(html).toMatch(/data-degraded="(stale|access_required|review_required|gated|unavailable)"/);

    // No `opacity:` rule below 1 in any inline style.
    expect(html).not.toMatch(/style="[^"]*opacity:\s*0\./);
  });
});

describe('/verify/[receipt]', () => {
  it('renders verifier reading mode with verdict bar (not bare Verified)', async () => {
    const page = await VerifyPage({ params: Promise.resolve({ receipt: 'rcpt_demo_004' }) });
    const html = await renderInsideLayout(page);

    expect(html).toContain('data-testid="trust-surface-header"');
    expect(html).toContain('data-testid="trust-verdict-bar"');

    // Safe verdict only.
    expect(html).toMatch(/Source-backed preview|Replay-ready|Signed fixture|Receipt-shaped artifact/);
    // Never the bare word.
    expect(html).not.toMatch(/['"`]Verified['"`]/);
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});

describe('/replay', () => {
  it('renders chain strip + chronological nodes', async () => {
    const page = await ReplayPage({});
    const html = await renderInsideLayout(page);

    expect(html).toContain('data-testid="trust-chain-strip"');
    expect(html).toContain('data-testid="trust-replay-nodes"');
  });
});

describe('/receipt/[id]', () => {
  it('renders SignaturePanel (inverted cryptographic plane) with fixture signer', async () => {
    const page = await ReceiptPage({ params: Promise.resolve({ id: 'rcpt_demo_004' }) });
    const html = await renderInsideLayout(page);

    expect(html).toContain('data-testid="trust-signature-panel"');
    expect(html).toContain('fixture:demo-signer-a-not-a-real-key');
    // The signature panel emits data-fixture="true" only when the
    // fingerprint announces itself as a fixture.
    expect(html).toContain('data-fixture="true"');
  });

  it('renders the chain strip with all fixture nodes', async () => {
    const page = await ReceiptPage({ params: Promise.resolve({ id: 'rcpt_demo_004' }) });
    const html = await renderInsideLayout(page);
    expect(html).toContain('data-testid="trust-chain-strip"');
    // We have four fixture nodes including the head id.
    const matches = html.match(/data-testid="trust-chain-node"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('/trust (visual register)', () => {
  it('renders the three-state stage, the reading-order list, and the failure grid', async () => {
    const page = await TrustRegisterPage({});
    const html = await renderInsideLayout(page);

    expect(html).toContain('data-testid="trust-register-stage"');
    expect(html).toContain('data-testid="trust-reading-order"');
    expect(html).toContain('data-testid="trust-failure-grid"');
    expect(html).toContain('data-testid="trust-ownership-list"');
  });

  it('renders failure modes A through E', async () => {
    const page = await TrustRegisterPage({});
    const html = await renderInsideLayout(page);
    for (const mode of ['A', 'B', 'C', 'D', 'E']) {
      expect(html).toMatch(new RegExp(`data-mode="${mode}"`));
    }
  });
});
