import { describe, expect, it } from 'vitest';
import {
  buildIntelligenceHref,
  buildLegacyRedirectHref,
  deriveIntelligenceNavKey,
  resolveIntelligenceView,
} from '../lib/intelligence/routes';
import { resolveOperationsNavKey } from '../components/intelligence-ops/shell';

describe('intelligence routes', () => {
  it('keeps /graph as a first-class nav destination', () => {
    expect(deriveIntelligenceNavKey('/graph')).toBe('graph');
    expect(deriveIntelligenceNavKey('/graph?npi=1234567890')).toBe('graph');
  });

  it('does not treat graph as an intelligence view', () => {
    expect(resolveIntelligenceView('graph')).toBe('dashboard');
    expect(resolveIntelligenceView(undefined)).toBe('dashboard');
  });

  it('builds canonical view-based intelligence hrefs', () => {
    const href = new URL(buildIntelligenceHref('findings', { provider: '1234567890' }), 'https://vitalcv.local');
    expect(href.pathname).toBe('/intelligence');
    expect(href.searchParams.get('view')).toBe('findings');
    expect(href.searchParams.get('tab')).toBeNull();
    expect(href.searchParams.get('provider')).toBe('1234567890');
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
});

describe('operations shell nav override', () => {
  it('normalizes dashboard nav to graph on /graph routes', () => {
    expect(resolveOperationsNavKey('/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph')).toBe('graph');
  });

  it('preserves explicit non-graph nav choices', () => {
    expect(resolveOperationsNavKey('/graph', 'investigations')).toBe('investigations');
    expect(resolveOperationsNavKey('/intelligence', 'dashboard')).toBe('dashboard');
  });
});
