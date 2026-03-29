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

const useIngestStreamMock = vi.fn();
const startIngestMock = vi.fn();
const searchParamsState = vi.hoisted(() => ({
  value: null as Pick<URLSearchParams, 'get'> | null,
}));

vi.mock('@/hooks/useIngestStream', () => ({
  useIngestStream: () => useIngestStreamMock(),
}));

vi.mock('@/lib/pilot-ops/client', () => ({
  trackPilotEvent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsState.value,
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
    startIngest: startIngestMock,
    reset: vi.fn(),
  });

  return renderToStaticMarkup(<PassportPage />);
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mountPassportPage(options: {
  searchParams?: Pick<URLSearchParams, 'get'> | null;
  state?: IngestStreamState;
} = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  searchParamsState.value = options.searchParams ?? null;
  useIngestStreamMock.mockReturnValue({
    state: options.state ?? createInitialIngestStreamState(),
    startIngest: startIngestMock,
    reset: vi.fn(),
  });

  await act(async () => {
    root.render(<PassportPage />);
  });
  await flush();

  return {
    container,
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
    startIngestMock.mockReset();
    searchParamsState.value = null;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    expect(markup).toContain('No profile found for this NPI yet.');
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

  it('auto-starts ingest from the canonical homepage handoff query param', async () => {
    const view = await mountPassportPage({
      searchParams: new URLSearchParams('npi=1234567890'),
    });

    expect(startIngestMock).toHaveBeenCalledTimes(1);
    expect(startIngestMock).toHaveBeenCalledWith('1234567890');

    await view.unmount();
  });
});
