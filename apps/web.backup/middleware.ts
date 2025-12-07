/**
 * Next.js Middleware for i18n
 * Handles locale detection and routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './src/i18n';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Task 38.1: Add subdomain detection
  // Extract tenant slug from hostname (e.g., "tenant.domain.com" -> "tenant")
  const hostname = request.headers.get('host') || '';
  const tenantSlug = hostname.split('.')[0];

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  let response: NextResponse;

  // Create a new headers object to pass the tenant slug
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSlug);

  if (pathnameHasLocale) {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } else {
    // Detect locale from Accept-Language header or use default
    const locale = getLocale(request) || defaultLocale;

    // Redirect to locale-prefixed URL
    request.nextUrl.pathname = `/${locale}${pathname}`;
    response = NextResponse.redirect(request.nextUrl);
  }

  // Pass tenantSlug to response headers for client-side access if needed
  response.headers.set('x-tenant-slug', tenantSlug);

  // Add Vercel Caching Headers
  // Credential public metadata (1h TTL)
  if (pathname.includes('/verify') || pathname.includes('/verifier')) {
    response.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
  // Static assets and public pages
  else if (pathname === '/' || locales.some(l => pathname === `/${l}`)) {
    response.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }

  return response;
}

function getLocale(request: NextRequest): string | undefined {
  // Check cookie first
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferredLocale = acceptLanguage.split(',')[0].split('-')[0];
    if (locales.includes(preferredLocale as any)) {
      return preferredLocale;
    }
  }

  return defaultLocale;
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|manifest.json|icon-.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};

