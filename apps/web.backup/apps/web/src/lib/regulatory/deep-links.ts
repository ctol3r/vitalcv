/**
 * Regulatory Portal - Deep Link Handler
 * Task 8: Add deep link: vitalcv://regulatory
 * Task 32: Add deep link: vitalcv://regulatory/cms
 */

'use client';

/**
 * Handle deep links for regulatory portal
 * Supports:
 * - vitalcv://regulatory
 * - vitalcv://regulatory/cms
 * - vitalcv://regulatory/state-boards
 * - vitalcv://regulatory/dea
 * - vitalcv://regulatory/payers
 */
export function handleRegulatoryDeepLink(url: string): string | null {
  // Parse vitalcv:// protocol URLs
  if (!url.startsWith('vitalcv://')) {
    return null;
  }

  const path = url.replace('vitalcv://', '');

  // Map deep links to routes
  const routeMap: Record<string, string> = {
    'regulatory': '/regulatory',
    'regulatory/cms': '/regulatory?tab=cms',
    'regulatory/state-boards': '/regulatory?tab=state-boards',
    'regulatory/dea': '/regulatory?tab=dea',
    'regulatory/payers': '/regulatory?tab=payers',
  };

  return routeMap[path] || null;
}

/**
 * Initialize deep link listener
 * Call this in a useEffect in the regulatory page
 */
export function initDeepLinkListener(
  onNavigate: (path: string) => void,
): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'vitalcv-deep-link') {
      const route = handleRegulatoryDeepLink(event.data.url);
      if (route) {
        onNavigate(route);
      }
    }
  };

  // Listen for postMessage from parent window or mobile app
  window.addEventListener('message', handleMessage);

  // Also check for URL parameters on page load
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const deepLink = urlParams.get('deepLink');
    if (deepLink) {
      const route = handleRegulatoryDeepLink(deepLink);
      if (route) {
        onNavigate(route);
      }
    }
  }

  return () => {
    window.removeEventListener('message', handleMessage);
  };
}








