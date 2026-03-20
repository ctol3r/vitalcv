import { describe, expect, it } from 'vitest';
import {
  buildIntelligenceGraphHref,
  buildIntelligenceHref,
  buildLegacyRedirectHref,
  deriveIntelligenceNavKey,
  normalizeIntelligenceHref,
  resolveIntelligenceView,
} from '../lib/intelligence/routes';
import { resolveOperationsNavKey } from '../components/intelligence-ops/shell';

describe('intelligence routes', () => {
  it('keeps graph routes mapped to the graph nav state', () => {
    expect(deriveIntelligenceNavKey('/intelligence/graph')).toBe('graph');
    expect(deriveIntelligenceNavKey('/intelligence/graph?npi=1234567890')).toBe('graph');
    expect(deriveIntelligenceNavKey('/graph')).toBe('graph');
    expect(deriveIntelligenceNavKey('/graph?npi=1234567890')).toBe('graph');
  });

  it('treats graph as a valid intelligence view', () => {
    expect(resolveIntelligenceView('graph')).toBe('graph');
    expect(resolveIntelligenceView(undefined)).toBe('dashboard');
  });

  it('builds canonical view-based intelligence hrefs', () => {
    const href = new URL(buildIntelligenceHref('findings', { provider: '1234567890' }), 'https://vitalcv.local');
    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('findings');
    expect(href.searchParams.get('provider')).toBe('1234567890');
  });

  it('builds canonical graph hrefs under /intelligence', () => {
    const href = new URL(buildIntelligenceGraphHref({ npi: '1234567890', findingId: 'finding-1' }), 'https://vitalcv.local');
    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('graph');
    expect(href.searchParams.get('npi')).toBe('1234567890');
    expect(href.searchParams.get('findingId')).toBe('finding-1');
  });

  it('normalizes legacy redirects by emitting canonical view params', () => {
    const href = new URL(buildLegacyRedirectHref('providers', {
      q: 'cardiology',
      tab: 'findings',
      view: 'dashboard',
    }), 'https://vitalcv.local');

    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('providers');
    expect(href.searchParams.get('q')).toBe('cardiology');
  });

  it('redirects legacy graph views to the canonical graph view', () => {
    const href = new URL(buildLegacyRedirectHref('graph', {
      npi: '1234567890',
      view: 'graph',
      findingId: 'finding-1',
    }), 'https://vitalcv.local');

    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('graph');
    expect(href.searchParams.get('npi')).toBe('1234567890');
    expect(href.searchParams.get('findingId')).toBe('finding-1');
  });

  it('normalizes legacy entity detail hrefs into dashboard canvas hrefs', () => {
    const providerHref = new URL(
      normalizeIntelligenceHref('/providers/1234567890?from=%2Fgraph'),
      'https://vitalcv.local',
    );
    expect(providerHref.pathname).toBe('/intelligence');
    expect(providerHref.searchParams.get('view')).toBe('dashboard');
    expect(providerHref.searchParams.get('npi')).toBe('1234567890');
    expect(providerHref.searchParams.getAll('open')).toContain('provider');
    expect(providerHref.searchParams.get('from')).toBeNull();

    const findingHref = new URL(
      normalizeIntelligenceHref('/findings/finding-1'),
      'https://vitalcv.local',
    );
    expect(findingHref.pathname).toBe('/intelligence');
    expect(findingHref.searchParams.get('view')).toBe('dashboard');
    expect(findingHref.searchParams.get('findingId')).toBe('finding-1');
    expect(findingHref.searchParams.getAll('open')).toContain('finding');
  });

  it('normalizes legacy focus links into canonical view params', () => {
    const graphHref = new URL(
      normalizeIntelligenceHref('/intelligence?focus=graph&npi=1234567890'),
      'https://vitalcv.local',
    );
    expect(graphHref.pathname).toBe('/intelligence');
    expect(graphHref.searchParams.get('view')).toBe('graph');
    expect(graphHref.searchParams.get('npi')).toBe('1234567890');

    const providerHref = new URL(
      normalizeIntelligenceHref('/intelligence?focus=provider&id=1234567890'),
      'https://vitalcv.local',
    );
    expect(providerHref.pathname).toBe('/intelligence');
    expect(providerHref.searchParams.get('view')).toBe('dashboard');
    expect(providerHref.searchParams.get('npi')).toBe('1234567890');
    expect(providerHref.searchParams.getAll('open')).toContain('provider');
  });
});

describe('operations shell nav override', () => {
  it('normalizes dashboard nav to graph on /graph routes', () => {
    expect(resolveOperationsNavKey('/intelligence/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/intelligence?focus=graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph')).toBe('graph');
  });

  it('preserves explicit non-graph nav choices', () => {
    expect(resolveOperationsNavKey('/graph', 'investigations')).toBe('investigations');
    expect(resolveOperationsNavKey('/intelligence', 'dashboard')).toBe('dashboard');
  });
});
