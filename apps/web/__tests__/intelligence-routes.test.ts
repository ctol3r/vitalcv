import { describe, expect, it } from 'vitest';
import {
  buildIntelligenceGraphHref,
  buildIntelligenceHref,
  buildLegacyRedirectHref,
  deriveIntelligenceNavKey,
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
    expect(href.searchParams.get('tab')).toBeNull();
    expect(href.searchParams.get('provider')).toBe('1234567890');
  });

  it('builds canonical graph hrefs under /intelligence/graph', () => {
    const href = new URL(buildIntelligenceGraphHref({ npi: '1234567890', findingId: 'finding-1' }), 'https://vitalcv.local');
    expect(href.pathname).toBe('/intelligence/graph');
    expect(href.searchParams.get('npi')).toBe('1234567890');
    expect(href.searchParams.get('findingId')).toBe('finding-1');
  });

  it('normalizes legacy redirects by removing view and preserving remaining params', () => {
    const href = new URL(buildLegacyRedirectHref('providers', {
      q: 'cardiology',
      tab: 'findings',
      view: 'dashboard',
    }), 'https://vitalcv.local');

    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('providers');
    expect(href.searchParams.get('tab')).toBeNull();
    expect(href.searchParams.get('q')).toBe('cardiology');
  });

  it('redirects legacy graph views to the dedicated graph route', () => {
    const href = new URL(buildLegacyRedirectHref('graph', {
      npi: '1234567890',
      view: 'graph',
      findingId: 'finding-1',
    }), 'https://vitalcv.local');

    expect(href.pathname).toBe('/intelligence/graph');
    expect(href.searchParams.get('view')).toBeNull();
    expect(href.searchParams.get('npi')).toBe('1234567890');
    expect(href.searchParams.get('findingId')).toBe('finding-1');
  });
});

describe('operations shell nav override', () => {
  it('normalizes dashboard nav to graph on /graph routes', () => {
    expect(resolveOperationsNavKey('/intelligence/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph')).toBe('graph');
  });

  it('preserves explicit non-graph nav choices', () => {
    expect(resolveOperationsNavKey('/graph', 'investigations')).toBe('investigations');
    expect(resolveOperationsNavKey('/intelligence', 'dashboard')).toBe('dashboard');
  });
});
