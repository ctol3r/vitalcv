/**
 * Example secure API route demonstrating security best practices
 *
 * This route shows how to:
 * - Validate CSRF tokens
 * - Apply rate limiting
 * - Sanitize user input
 * - Handle errors securely
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCsrfToken, setCsrfTokenCookie } from '@/lib/security/csrf';
import { checkRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/security/rate-limit';
import { validateAndSanitize } from '@/lib/security/sanitize';
import { handleApiError, withErrorHandler, ErrorCode, createErrorResponse } from '@/lib/security/error-handler';

/**
 * GET /api/example-secure
 * Returns a CSRF token for the client
 */
export async function GET(request: NextRequest) {
  try {
    // Generate and set CSRF token
    const response = NextResponse.json({ message: 'CSRF token generated' });
    return setCsrfTokenCookie(response);
  } catch (error) {
    return handleApiError(error, {
      endpoint: '/api/example-secure',
      requestId: request.headers.get('x-request-id') || undefined,
    });
  }
}

/**
 * POST /api/example-secure
 * Example of a secure POST endpoint with all protections
 */
export const POST = withErrorHandler(async function POST(request: NextRequest) {
  // 1. Rate limiting
  const rateLimitResult = checkRateLimit(request, RATE_LIMITS.default);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  // 2. CSRF protection
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 3. Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      400
    );
  }

  // 4. Sanitize user input
  const sanitizedInput = validateAndSanitize(body.input, {
    maxLength: 1000,
    required: true,
  });

  // 5. Process request (example)
  // ... your business logic here ...

  // 6. Return response with rate limit headers
  const response = NextResponse.json({
    message: 'Request processed successfully',
    input: sanitizedInput, // Sanitized input is safe to return
  });

  // Add rate limit headers
  Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
});

