/**
 * S72-D3-C-004: Demo mode configuration
 *
 * Provides a central configuration helper for demo mode.
 * When DEMO=true, demo endpoints are accessible.
 * When DEMO=false, demo endpoints return 404 or require special header.
 */

/**
 * Check if demo mode is enabled
 * @returns {boolean} True if DEMO=true in environment
 */
export function isDemo(): boolean {
  return process.env.DEMO === 'true';
}

/**
 * Get required demo header name
 * Used when DEMO=false but we want to allow demo access with special header
 */
export const DEMO_HEADER = 'X-Chai-Demo-Access';

/**
 * Get required demo header value
 */
export const DEMO_HEADER_VALUE = process.env.DEMO_ACCESS_KEY || 'demo-access-key';

/**
 * Middleware to protect demo routes
 * Returns 404 if demo mode is not enabled and no special header provided
 */
export function requireDemo() {
  return (req: any, res: any, next: any) => {
    // If demo mode is enabled, allow access
    if (isDemo()) {
      return next();
    }

    // If demo header is provided with correct value, allow access
    const demoHeader = req.get(DEMO_HEADER);
    if (demoHeader && demoHeader === DEMO_HEADER_VALUE) {
      return next();
    }

    // Otherwise, return 404 to hide demo endpoints
    return res.status(404).json({ error: 'Not found' });
  };
}

