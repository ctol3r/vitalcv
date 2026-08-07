import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildWebAppUrl } from './lib/webAppUrl';

function mapMarketingPath(pathname: string): string {
  if (pathname === '/' || pathname === '/how-it-works') {
    return '/';
  }

  if (pathname === '/clinician') {
    // /passport retired 2026-08-07 — one hop straight to the canonical entry.
    return '/onboarding';
  }

  if (pathname === '/verifier') {
    return '/review';
  }

  if (pathname === '/contact') {
    return '/pilot';
  }

  if (pathname === '/security' || pathname === '/internal/metrics') {
    return '/status';
  }

  if (pathname === '/progress') {
    return '/pilot';
  }

  if (pathname.startsWith('/demo')) {
    return '/demo';
  }

  if (pathname.startsWith('/verify/')) {
    const shareId = pathname.slice('/verify/'.length);
    return shareId.length > 0 ? `/p/${shareId}` : '/';
  }

  return '/';
}

export function middleware(request: NextRequest) {
  const destination = mapMarketingPath(request.nextUrl.pathname);
  const redirectUrl = buildWebAppUrl(destination, request.nextUrl.search);
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|.*\\..*).*)'],
};
