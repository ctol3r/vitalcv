/**
 * Security Headers Middleware for Next.js Web Frontend
 *
 * Implements modern HTTP security headers for web application:
 * - CSP (Content-Security-Policy) with nonce support
 * - HSTS (Strict-Transport-Security)
 * - Referrer-Policy
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Permissions-Policy
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 * @module middleware/securityHeaders
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSP configuration for Next.js app
 * Allows first-party scripts, styles, and required external resources
 */
interface CSPConfig {
  /** Enable nonce-based script CSP */
  useNonce: boolean;
  /** Additional script-src domains */
  scriptSrc?: string[];
  /** Additional style-src domains */
  styleSrc?: string[];
  /** Additional connect-src domains (API endpoints) */
  connectSrc?: string[];
  /** Additional img-src domains */
  imgSrc?: string[];
  /** Additional font-src domains */
  fontSrc?: string[];
  /** Enable unsafe-inline for styles (needed for some UI libraries) */
  unsafeInlineStyles?: boolean;
}

/**
 * Default CSP configuration for VitalCV web app
 */
const DEFAULT_CSP_CONFIG: CSPConfig = {
  useNonce: true,
  scriptSrc: [
    "'self'",
    // Add any required CDN domains (e.g., for analytics, monitoring)
    // 'https://cdn.example.com',
  ],
  styleSrc: [
    "'self'",
    // Tailwind/utility CSS may require unsafe-inline in some cases
  ],
  connectSrc: [
    "'self'",
    // API endpoints
    process.env.NEXT_PUBLIC_API_URL || 'https://api.vitalcv.com',
    process.env.NEXT_PUBLIC_ISSUER_URL || 'https://issuer.vitalcv.com',
    process.env.NEXT_PUBLIC_VERIFIER_URL || 'https://verifier.vitalcv.com',
  ],
  imgSrc: [
    "'self'",
    'data:', // Allow data URLs for inline images
    'blob:', // Allow blob URLs for dynamic content
  ],
  fontSrc: [
    "'self'",
    'data:', // For inline fonts
  ],
  unsafeInlineStyles: false,
};

/**
 * Generates a cryptographically secure nonce for CSP
 */
function generateNonce(): string {
  return uuidv4().replace(/-/g, '');
}

/**
 * Builds CSP header value from configuration
 */
function buildCSP(config: CSPConfig, nonce?: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      ...config.scriptSrc || ["'self'"],
      ...(config.useNonce && nonce ? [`'nonce-${nonce}'`] : []),
      "'strict-dynamic'", // Allow scripts loaded by nonce'd scripts
    ],
    'style-src': [
      ...config.styleSrc || ["'self'"],
      ...(config.unsafeInlineStyles ? ["'unsafe-inline'"] : []),
    ],
    'connect-src': config.connectSrc || ["'self'"],
    'img-src': config.imgSrc || ["'self'", 'data:', 'blob:'],
    'font-src': config.fontSrc || ["'self'", 'data:'],
    'object-src': ["'none'"], // Disallow plugins
    'base-uri': ["'self'"], // Restrict <base> tag
    'form-action': ["'self'"], // Restrict form submissions
    'frame-ancestors': ["'none'"], // Prevent framing (clickjacking)
    'upgrade-insecure-requests': [], // Upgrade HTTP to HTTPS
  };

  // Filter out empty directives and format
  return Object.entries(directives)
    .filter(([_, values]) => values.length > 0 || _ === 'upgrade-insecure-requests')
    .map(([key, values]) => values.length > 0 ? `${key} ${values.join(' ')}` : key)
    .join('; ');
}

/**
 * Builds Permissions-Policy header
 */
function buildPermissionsPolicy(): string {
  const policies = {
    'geolocation': [], // No geolocation access
    'microphone': [], // No microphone (unless explicitly enabled for video interviews)
    'camera': [], // No camera (unless explicitly enabled for video interviews)
    'payment': [], // No payment API
    'usb': [], // No USB access
    'magnetometer': [], // No magnetometer
    'gyroscope': [], // No gyroscope
    'accelerometer': [], // No accelerometer
    'ambient-light-sensor': [], // No ambient light
    'autoplay': ["'self'"], // Allow autoplay only from same origin
    'fullscreen': ["'self'"], // Allow fullscreen only from same origin
  };

  return Object.entries(policies)
    .map(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowlist.join(' ')})`;
    })
    .join(', ');
}

/**
 * Next.js middleware for security headers
 *
 * @param request - Next.js request object
 * @returns Next.js response with security headers
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { securityHeadersMiddleware } from './src/middleware/securityHeaders';
 *
 * export function middleware(request: NextRequest) {
 *   return securityHeadersMiddleware(request);
 * }
 *
 * export const config = {
 *   matcher: [
 *     '/((?!api|_next/static|_next/image|favicon.ico).*)',
 *   ],
 * };
 * ```
 */
export function securityHeadersMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Generate nonce for this request
  const nonce = generateNonce();

  // Build CSP with nonce
  const csp = buildCSP(DEFAULT_CSP_CONFIG, nonce);

  // Set security headers
  response.headers.set('Content-Security-Policy', csp);

  // Store nonce for use in pages (access via headers in Server Components)
  response.headers.set('X-Nonce', nonce);

  // HSTS: Force HTTPS
  if (request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // X-Frame-Options: Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection: Legacy XSS protection for older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: Restrict browser features
  response.headers.set('Permissions-Policy', buildPermissionsPolicy());

  // Cross-Origin-Opener-Policy: Isolate browsing context
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Cross-Origin-Embedder-Policy: Prevent cross-origin resource loading
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

  // Cross-Origin-Resource-Policy: Control resource sharing
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return response;
}

/**
 * Helper to extract nonce from response headers in Server Components
 *
 * @example
 * ```typescript
 * import { headers } from 'next/headers';
 * import { getNonce } from '@/middleware/securityHeaders';
 *
 * export default function Page() {
 *   const nonce = getNonce();
 *   return (
 *     <html>
 *       <head>
 *         <script nonce={nonce} src="/app.js" />
 *       </head>
 *     </html>
 *   );
 * }
 * ```
 */
export function getNonce(): string | undefined {
  // In Next.js App Router, we need to use headers() from next/headers
  // This is a placeholder - actual implementation depends on Next.js version
  if (typeof window === 'undefined') {
    // Server-side: access from response headers (implementation specific)
    return undefined;
  }
  return undefined;
}

/**
 * Configuration for next.config.mjs
 * Use this to set headers at the Next.js level (alternative to middleware)
 *
 * @example
 * ```typescript
 * // next.config.mjs
 * import { nextConfigHeaders } from './src/middleware/securityHeaders';
 *
 * export default {
 *   async headers() {
 *     return nextConfigHeaders;
 *   },
 * };
 * ```
 */
export const nextConfigHeaders = [
  {
    source: '/:path*',
    headers: [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: buildPermissionsPolicy(),
      },
    ],
  },
  {
    source: '/:path*',
    has: [
      {
        type: 'header',
        key: 'x-forwarded-proto',
        value: 'https',
      },
    ],
    headers: [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
    ],
  },
];

/**
 * Export default middleware
 */
export default securityHeadersMiddleware;

