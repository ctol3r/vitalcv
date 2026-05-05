import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('server-only', () => ({}));

const writeMock = vi.fn();
vi.mock('@/lib/issuer-verification/issuerPersistenceWriter', () => ({
  writeReceiptCandidateRow: (...args: unknown[]) => writeMock(...args),
  isIssuerPersistenceEnabled: () => false,
}));

import IssuerReviewPage from '../app/issuer/review/[requestId]/page';

const REQUEST_ID = 'req-test-1';

beforeEach(() => {
  writeMock.mockReset();
});

afterEach(() => {
  writeMock.mockReset();
});

async function renderPage(): Promise<string> {
  const element = await IssuerReviewPage({ params: Promise.resolve({ requestId: REQUEST_ID }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('issuer review page — persistence wiring', () => {
  it('renders disabled banner and recordedBy=demo when writer reports disabled', async () => {
    writeMock.mockResolvedValueOnce({ status: 'disabled', recordedBy: 'demo' });
    const html = await renderPage();
    expect(html).toContain('data-testid="persistence-banner"');
    expect(html).toContain('data-banner-state="disabled"');
    expect(html).toContain('data-recorded-by="demo"');
    expect(html).toContain('data-persistence-status="disabled"');
    expect(html).toContain('Persistence disabled');
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it('renders persisted banner and recordedBy=system when writer reports persisted', async () => {
    writeMock.mockResolvedValueOnce({ status: 'persisted', recordedBy: 'system' });
    const html = await renderPage();
    expect(html).toContain('data-banner-state="persisted"');
    expect(html).toContain('data-recorded-by="system"');
    expect(html).toContain('data-persistence-status="persisted"');
    expect(html).toContain('Candidate row recorded');
  });

  it('renders tamper_detected banner and recordedBy=demo on DB CHECK violation', async () => {
    writeMock.mockResolvedValueOnce({ status: 'tamper_detected', recordedBy: 'demo' });
    const html = await renderPage();
    expect(html).toContain('data-banner-state="tamper_detected"');
    expect(html).toContain('data-recorded-by="demo"');
    expect(html).toContain('Candidate row CHECK violation');
  });

  it('renders transient_error banner and recordedBy=demo on connection failure', async () => {
    writeMock.mockResolvedValueOnce({ status: 'transient_error', recordedBy: 'demo' });
    const html = await renderPage();
    expect(html).toContain('data-banner-state="transient_error"');
    expect(html).toContain('data-recorded-by="demo"');
    expect(html).toContain('Persistence unavailable');
  });

  it('degrades to transient_error when the writer itself throws (unexpected error)', async () => {
    writeMock.mockImplementationOnce(() => {
      throw new Error('writer module crashed unexpectedly');
    });
    const html = await renderPage();
    expect(html).toContain('data-banner-state="transient_error"');
    expect(html).toContain('data-recorded-by="demo"');
    expect(html).toContain('Persistence unavailable');
  });

  it('preserves the truth-contract literals on the rendered page in every persistence state', async () => {
    for (const outcome of [
      { status: 'disabled', recordedBy: 'demo' },
      { status: 'persisted', recordedBy: 'system' },
      { status: 'tamper_detected', recordedBy: 'demo' },
      { status: 'transient_error', recordedBy: 'demo' },
    ] as const) {
      writeMock.mockResolvedValueOnce(outcome);
      const html = await renderPage();
      expect(html).toContain('data-decision-grade="false"');
      expect(html).toContain('data-proof-tier="receipt_candidate"');
    }
  });
});
