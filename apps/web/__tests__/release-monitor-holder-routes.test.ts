import { describe, expect, it } from 'vitest';
import {
  HOLDER_ROUTES,
  analyzeNavigation,
  isAuthErrorPath,
  isResolvingPath,
  isSignInPath,
  pathOf,
  type NavHop,
} from '../lib/release-monitor/holderRoutes';

describe('HOLDER_ROUTES', () => {
  it('is exactly the six required signed-in surfaces', () => {
    expect(HOLDER_ROUTES).toEqual([
      '/holder',
      '/holder/home',
      '/holder/readiness',
      '/holder/opportunities',
      '/holder/applications',
      '/holder/timeline',
    ]);
  });
});

describe('path predicates', () => {
  it('classify paths and absolute URLs alike', () => {
    expect(isAuthErrorPath('/auth/error')).toBe(true);
    expect(isAuthErrorPath('https://vitalcv.com/auth/error?x=1')).toBe(true);
    expect(isAuthErrorPath('/holder')).toBe(false);
    expect(isSignInPath('/sign-in?redirect_url=/holder')).toBe(true);
    expect(isResolvingPath('/auth/resolving')).toBe(true);
    expect(pathOf('https://x.com/a/b?q=1#h')).toBe('/a/b');
  });
});

describe('analyzeNavigation', () => {
  it('passes a single clean 200', () => {
    const out = analyzeNavigation([{ url: '/holder', status: 200 }]);
    expect(out.ok).toBe(true);
    expect(out.finalStatus).toBe(200);
  });

  it('fails when any hop redirects to /auth/error (the P0 signature)', () => {
    const hops: NavHop[] = [
      { url: '/holder', status: 307, location: '/auth/error' },
      { url: '/auth/error', status: 200 },
    ];
    const out = analyzeNavigation(hops);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('auth_error');
  });

  it('fails on a redirect loop (repeated path)', () => {
    const hops: NavHop[] = [
      { url: '/holder', status: 307, location: '/holder' },
      { url: '/holder', status: 307, location: '/holder' },
    ];
    expect(analyzeNavigation(hops).reason).toBe('redirect_loop');
  });

  it('fails when bounced to /sign-in', () => {
    const out = analyzeNavigation([{ url: '/holder', status: 307, location: '/sign-in?redirect_url=/holder' }]);
    expect(out.reason).toBe('sign_in');
  });

  it('fails a terminal 3xx as too_many_hops', () => {
    expect(analyzeNavigation([{ url: '/holder', status: 307, location: '/elsewhere' }]).reason).toBe('too_many_hops');
  });

  it('fails a terminal non-200 non-3xx', () => {
    expect(analyzeNavigation([{ url: '/holder', status: 500 }]).reason).toBe('non_200');
  });

  it('fails an empty chain', () => {
    expect(analyzeNavigation([]).reason).toBe('no_hops');
  });
});
