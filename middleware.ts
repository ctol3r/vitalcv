import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, applyCORSHeaders, getAllowedOrigins } from '@/lib/security/headers'

/**
 * Next.js Middleware for VitalCV
 *
 * Applies security headers and CORS configuration to all requests.
 */

export function middleware(request: NextRequest) {
  // Create response
  let response = NextResponse.next()

  // Apply security headers
  response = applySecurityHeaders(response)

  // Apply CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin')
    response = applyCORSHeaders(response, origin, {
      allowedOrigins: getAllowedOrigins(),
      credentials: true,
    })
  }

  return response
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
