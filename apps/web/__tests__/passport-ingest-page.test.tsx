// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PassportPage from '../app/passport/page';
import { createInitialIngestStreamState, type IngestStreamState } from '../hooks/ingestStreamState';
import {
  buildEmployerReviewHref,
  buildPassportEntityHref,
} from '../lib/trust/public-wedge-parity';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const useIngestStreamMock = vi.fn();
let searchParamsValue: URLSearchParams | null = null;

vi.mock('@/hooks/useIngestStream', () => ({
  useIngestStream: () => useIngestStreamMock(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsValue,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function buildState(partial: Partial<IngestStreamState>): IngestStreamState {
  const base = createInitialIngestStreamState();

  return {
    ...base,
    ...partial,
    identity: {
      ...base.identity,
      ...partial.identity,
    },
    standing: {
      ...base.standing,
      ...partial.standing,
    },
    readiness: {
      ...base.readiness,
      ...partial.readiness,
    },
    sources: {
      ...base.sources,
      ...partial.sources,
    },
    events: partial.events ?? base.events,
  };
}

function renderForState(state: IngestStreamState): string {
  useIngestStreamMock.mockReturnValue({
    state,
    startIngest: vi.fn(),
    reset: vi.fn(),
  });

  return renderToStaticMarkup(<PassportPage />);
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderInteractive({
  state = buildState({}),
  startIngest = vi.fn(),
  reset = vi.fn(),
}: {
  state?: IngestStreamState;
  startIngest?: ReturnType<typeof vi.fn>;
  reset?: ReturnType<typeof vi.fn>;
} = {}) {
  useIngestStreamMock.mockReturnValue({
    state,
    startIngest,
    reset,
  });

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<PassportPage />);
  });
  await flush();

  return {
    container,
    startIngest,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('/passport ingest page', () => {
  beforeEach(() => {
    useIngestStreamMock.mockReset();
    searchParamsValue = null;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders loading copy and queued source lanes while the ingest is still running', () => {
    const markup = renderForState(buildState({
      phase: 'nppes',
      npi: '1234567890',
      sources: {
        nppes: 'checking',
        oig: 'pending',
        pecos: 'pending',
      },
    }));

    expect(markup).toContain('Checking primary sources…');
    expect(markup).toContain('Identity');
    expect(markup).toContain('Sanctions (OIG)');
    expect(markup).toContain('Enrollment (CMS)');
    expect(markup).toContain('Checking');
    expect(markup).toContain('Pending');
    expect(markup).not.toContain('View full passport');
  });

  it('renders the passport CTA as soon as the profile is usable', () => {
    const markup = renderForState(buildState({
      phase: 'enrollment',
      npi: '1234567890',
      isUsable: true,
      anchorEntityId: 'entity-1',
      identity: {
        authoritative: true,
        displayName: 'Ada Lovelace',
        specialty: 'Family Medicine',
      },
      readiness: {
        score: 91,
      },
      sources: {
        nppes: 'done',
        oig: 'done',
        pecos: 'done',
      },
    }));

    expect(markup).toContain('View full passport');
    expect(markup).toContain(buildPassportEntityHref('entity-1'));
    expect(markup).toContain('View as employer');
    expect(markup).toContain(buildEmployerReviewHref('entity-1'));
  });

  it('renders an honest no-profile state when NPPES did not return an authoritative record', () => {
    const markup = renderForState(buildState({
      phase: 'done',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      identity: {
        authoritative: false,
        sourceResult: 'SKIPPED',
        status: 'UNKNOWN',
      },
      sources: {
        nppes: 'done',
        oig: 'done',
        pecos: 'done',
      },
    }));

    expect(markup).toContain('We could not retrieve your NPI profile.');
    expect(markup).toContain('Please verify your NPI is correct.');
    expect(markup).not.toContain('View full passport');
  });

  it('renders a completed-without-anchor state when the profile is authoritative but no anchor returned', () => {
    const markup = renderForState(buildState({
      phase: 'done',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      identity: {
        authoritative: true,
        displayName: 'Ada Lovelace',
        sourceResult: 'SUCCESS',
        status: 'ACTIVE',
      },
      sources: {
        nppes: 'done',
        oig: 'done',
        pecos: 'done',
      },
    }));

    expect(markup).toContain('Profile resolved but not yet anchored.');
    expect(markup).not.toContain('View full passport');
  });

  it('renders unavailable and review-required source states without upgrading them into checked proof', () => {
    const markup = renderForState(buildState({
      phase: 'done',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      identity: {
        authoritative: false,
        sourceResult: 'FAILED',
        status: 'UNKNOWN',
      },
      standing: {
        exclusionChecked: true,
        exclusionStatus: 'POSSIBLE_MATCH',
      },
      sources: {
        nppes: 'error',
        oig: 'done',
        pecos: 'pending',
      },
    }));

    expect(markup).toContain('Unavailable');
    expect(markup).toContain('Review required');
    expect(markup).not.toContain('View full passport');
  });

  it('renders a disconnected fallback when the stream drops before readiness is usable', () => {
    const markup = renderForState(buildState({
      phase: 'error',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      disconnected: true,
      error: 'Stream disconnected.',
      sources: {
        nppes: 'done',
        oig: 'error',
        pecos: 'pending',
      },
    }));

    expect(markup).toContain('Stream disconnected before your passport finished hydrating.');
    expect(markup).toContain('Check another NPI');
  });

  it('auto-starts the passport lookup when the homepage handoff preserves the NPI query param', async () => {
    searchParamsValue = new URLSearchParams('npi=1234567890');
    const view = await renderInteractive();

    try {
      expect(view.startIngest).toHaveBeenCalledOnce();
      expect(view.startIngest).toHaveBeenCalledWith('1234567890');
    } finally {
      await view.unmount();
    }
  });

  it('does not leak raw backend/internal error codes into the passport error card', () => {
    const markup = renderForState(buildState({
      phase: 'error',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      error: 'organization_context_required',
      sources: {
        nppes: 'error',
        oig: 'error',
        pecos: 'error',
      },
    }));

    expect(markup).toContain('load your readiness snapshot right now.');
    expect(markup).toContain('Try this NPI again in a moment.');
    expect(markup).toContain('Try this NPI again');
    expect(markup).not.toContain('organization_context_required');
  });

  it('renders unsupported and degraded source results with canonical honest labels', () => {
    const markup = renderForState(buildState({
      phase: 'done',
      completedAt: '2026-03-25T22:10:00.000Z',
      npi: '1234567890',
      identity: {
        authoritative: true,
        displayName: 'Ada Lovelace',
        sourceResult: 'SUCCESS',
        status: 'ACTIVE',
      },
      standing: {
        exclusionChecked: true,
        exclusionStatus: 'DEGRADED',
        enrollmentChecked: true,
        enrollmentStatus: 'UNSUPPORTED',
      },
      sources: {
        nppes: 'done',
        oig: 'done',
        pecos: 'done',
      },
    }));

    expect(markup).toContain('Access required');
    expect(markup).toContain('Unavailable');
    expect(markup).not.toContain('UNSUPPORTED');
    expect(markup).not.toContain('DEGRADED');
  });
});
