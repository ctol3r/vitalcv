/**
 * CSRF protection utilities for Next.js API routes
 *
 * Implements CSRF token generation and validation for state-changing operations.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generates a new CSRF token
 *
 * @returns CSRF token string
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Gets the current CSRF token from cookies or generates a new one
 *
 * @returns CSRF token
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_TOKEN_COOKIE)?.value;

  if (!token) {
    token = generateCsrfToken();
    // Note: In Next.js App Router, we can't set cookies in server components
    // This should be done in a route handler or middleware
  }

  return token;
}

/**
 * Validates a CSRF token from a request
 *
 * @param request - The request object
 * @returns True if token is valid
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Ensure tokens are the same length for timing-safe comparison
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken, 'utf8'),
      Buffer.from(headerToken, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Sets a CSRF token in the response cookies
 *
 * @param response - NextResponse object (optional, creates new if not provided)
 * @param token - CSRF token (optional, generates if not provided)
 * @returns NextResponse with CSRF token cookie
 */
export function setCsrfTokenCookie(
  response?: NextResponse,
  token?: string
): NextResponse {
  const csrfToken = token || generateCsrfToken();
  const nextResponse = response || new NextResponse();

  nextResponse.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return nextResponse;
}

/**
 * Middleware to validate CSRF token for state-changing requests
 *
 * @param request - The request object
 * @returns Error response if invalid, null if valid
 */
export async function requireCsrfToken(request: Request): Promise<Response | null> {
  const isValid = await validateCsrfToken(request);

  if (!isValid) {
    return new Response(
      JSON.stringify({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or missing CSRF token',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null;
}

/**
 * Gets CSRF token for client-side use
 * This should be called from a route handler that can set cookies
 *
 * @returns Object with CSRF token
 */
export async function getCsrfTokenForClient(): Promise<{ token: string }> {
  const token = await getCsrfToken();
  return { token };
}

