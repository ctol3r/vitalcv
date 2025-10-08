import { NextResponse } from 'next/server'

/**
 * Security Headers for VitalCV
 *
 * Implements comprehensive security headers following OWASP best practices.
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: boolean
  strictTransportSecurity?: boolean
  xFrameOptions?: boolean
  xContentTypeOptions?: boolean
  referrerPolicy?: boolean
  permissionsPolicy?: boolean
}

/**
 * Content Security Policy (CSP) configuration
 *
 * Prevents XSS, clickjacking, and other code injection attacks
 */
export function getCSP(isDevelopment: boolean = false): string {
  const policies = [
    // Default source: only same origin
    "default-src 'self'",

    // Scripts: self, inline (with nonce in production), and CDNs
    isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'", // Next.js requires unsafe-inline for some features

    // Styles: self and inline styles
    "style-src 'self' 'unsafe-inline'",

    // Images: self, data URIs, and common CDNs
    "img-src 'self' data: https: blob:",

    // Fonts: self and data URIs
    "font-src 'self' data:",

    // Connect (AJAX, WebSocket): self and API endpoints
    "connect-src 'self' https://eth.llamarpc.com https://rpc.sepolia.org https://polygon-rpc.com wss:",

    // Frame ancestors: prevent embedding (clickjacking protection)
    "frame-ancestors 'none'",

    // Base URI: restrict base tag
    "base-uri 'self'",

    // Form action: only same origin
    "form-action 'self'",

    // Object, embed: disallow plugins
    "object-src 'none'",

    // Media: self
    "media-src 'self'",

    // Manifest: self
    "manifest-src 'self'",

    // Worker: self
    "worker-src 'self' blob:",
  ]

  return policies.join('; ')
}

/**
 * Apply security headers to response
 *
 * @param response - NextResponse object
 * @param config - Security headers configuration
 * @returns Response with security headers
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = {}
): NextResponse {
  const {
    contentSecurityPolicy = true,
    strictTransportSecurity = true,
    xFrameOptions = true,
    xContentTypeOptions = true,
    referrerPolicy = true,
    permissionsPolicy = true,
  } = config

  const isDevelopment = process.env.NODE_ENV === 'development'

  // Content Security Policy (CSP)
  if (contentSecurityPolicy) {
    response.headers.set('Content-Security-Policy', getCSP(isDevelopment))
  }

  // HTTP Strict Transport Security (HSTS)
  // Enforces HTTPS connections
  if (strictTransportSecurity && !isDevelopment) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // X-Frame-Options
  // Prevents clickjacking attacks
  if (xFrameOptions) {
    response.headers.set('X-Frame-Options', 'DENY')
  }

  // X-Content-Type-Options
  // Prevents MIME type sniffing
  if (xContentTypeOptions) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  // Referrer-Policy
  // Controls referrer information
  if (referrerPolicy) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }

  // Permissions-Policy (formerly Feature-Policy)
  // Controls browser features and APIs
  if (permissionsPolicy) {
    const permissions = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ]
    response.headers.set('Permissions-Policy', permissions.join(', '))
  }

  // X-DNS-Prefetch-Control
  // Controls DNS prefetching
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  // X-XSS-Protection (legacy, but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Cross-Origin policies
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  return response
}

/**
 * Security headers middleware wrapper
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withSecurityHeaders(async () => {
 *     return NextResponse.json({ message: 'Hello' })
 *   })()
 * }
 */
export function withSecurityHeaders(
  handler: () => Promise<NextResponse>,
  config?: SecurityHeadersConfig
) {
  return async (): Promise<NextResponse> => {
    const response = await handler()
    return applySecurityHeaders(response, config)
  }
}

/**
 * CORS headers configuration
 */
export interface CORSConfig {
  allowedOrigins: string[]
  allowedMethods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

/**
 * Apply CORS headers to response
 *
 * @param response - NextResponse object
 * @param origin - Request origin
 * @param config - CORS configuration
 * @returns Response with CORS headers
 */
export function applyCORSHeaders(
  response: NextResponse,
  origin: string | null,
  config: CORSConfig
): NextResponse {
  const {
    allowedOrigins,
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials = true,
    maxAge = 86400, // 24 hours
  } = config

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
  }

  // Set other CORS headers
  response.headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '))
  response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  response.headers.set('Access-Control-Expose-Headers', exposedHeaders.join(', '))

  if (credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  response.headers.set('Access-Control-Max-Age', maxAge.toString())

  return response
}

/**
 * Get allowed origins from environment variable
 */
export function getAllowedOrigins(): string[] {
  const originsEnv = process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
  return originsEnv.split(',').map((origin) => origin.trim())
}
