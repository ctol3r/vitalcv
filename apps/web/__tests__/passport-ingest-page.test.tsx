import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PassportPage from '../app/passport/page';
import { createInitialIngestStreamState, type IngestStreamState } from '../hooks/ingestStreamState';
import {
  buildExploreApplyHref,
  buildEmployerReviewHref,
  buildPassportEntityHref,
} from '../lib/trust/public-wedge-parity';

const useIngestStreamMock = vi.fn();
const searchParamsState = {
  npi: null as string | null,
  role: null as string | null,
  employer: null as string | null,
};

vi.mock('@/hooks/useIngestStream', () => ({
  useIngestStream: () => useIngestStreamMock(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => (
    searchParamsState.npi || searchParamsState.role || searchParamsState.employer
      ? {
          get: (key: string) => {
            if (key === 'npi') return searchParamsState.npi;
            if (key === 'role') return searchParamsState.role;
            if (key === 'employer') return searchParamsState.employer;
            return null;
          },
        }
      : null
  ),
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

describe('/passport ingest page', () => {
  beforeEach(() => {
    useIngestStreamMock.mockReset();
    searchParamsState.npi = null;
    searchParamsState.role = null;
    searchParamsState.employer = null;
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
    expect(markup).toContain('NPPES');
    expect(markup).toContain('OIG / LEIE');
    expect(markup).toContain('CMS PECOS');
    expect(markup).toContain('Pending');
    expect(markup).not.toContain('View full passport');
  });

  it('boots directly into the ingest state when the homepage carries an NPI into /passport', () => {
    searchParamsState.npi = '1234567890';

    const markup = renderForState(buildState({
      phase: 'starting',
      npi: '1234567890',
    }));

    expect(markup).toContain('Connecting to primary sources…');
    expect(markup).toContain('Pending');
    expect(markup).not.toContain('Check your readiness');
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
    expect(markup).toContain('Explore matched roles');
    expect(markup).toContain(buildExploreApplyHref('1234567890'));
    expect(markup).toContain('View as employer');
    expect(markup).toContain(buildEmployerReviewHref('entity-1'));
  });

  it('keeps role-context apply continuity once the passport is usable', () => {
    searchParamsState.npi = '1234567890';
    searchParamsState.role = 'opp_1';
    searchParamsState.employer = 'legacy-health';

    const markup = renderForState(buildState({
      phase: 'done',
      completedAt: '2026-04-08T12:00:00.000Z',
      npi: '1234567890',
      isUsable: true,
      anchorEntityId: 'entity-1',
      identity: {
        authoritative: true,
        displayName: 'Ada Lovelace',
        specialty: 'Family Medicine',
      },
      sources: {
        nppes: 'done',
        oig: 'done',
        pecos: 'done',
      },
    }));

    expect(markup).toContain('Continue to apply');
    expect(markup).toContain(
      buildPassportEntityHref('entity-1', {
        roleId: 'opp_1',
        employerSlug: 'legacy-health',
      }).replaceAll('&', '&amp;'),
    );
    expect(markup).toContain(
      buildExploreApplyHref('1234567890', {
        roleId: 'opp_1',
        employerSlug: 'legacy-health',
      }).replaceAll('&', '&amp;'),
    );
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

  it('replaces organization context backend errors with sign-in passport copy', () => {
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

    expect(markup).toContain("We couldn&#x27;t load your readiness snapshot right now.");
    expect(markup).toContain('Try this NPI again in a moment.');
    expect(markup).not.toContain('organization_context_required');
  });
});
