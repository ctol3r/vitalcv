/**
 * Request ID Utilities for Distributed Tracing
 *
 * Extracts and propagates request IDs from API responses for debugging
 * and audit log correlation.
 */

export function extractRequestId(response: Response): string | null {
  // Try various common header names for request ID
  const possibleHeaders = [
    'x-request-id',
    'x-correlation-id',
    'x-trace-id',
    'request-id',
  ]

  for (const header of possibleHeaders) {
    const value = response.headers.get(header)
    if (value) {
      console.debug(`[Observability] Request ID extracted: ${value}`)
      return value
    }
  }

  return null
}

/**
 * Formats request ID for display
 */
export function formatRequestId(requestId: string | null): string {
  if (!requestId) return 'N/A'
  // Truncate long IDs for display (keep first 8 and last 4 chars)
  if (requestId.length > 20) {
    return `${requestId.slice(0, 8)}...${requestId.slice(-4)}`
  }
  return requestId
}

/**
 * Logs request ID for debugging
 */
export function logRequestId(requestId: string | null, context: string): void {
  if (requestId) {
    console.debug(`[${context}] Request ID: ${requestId}`)
  }
}
