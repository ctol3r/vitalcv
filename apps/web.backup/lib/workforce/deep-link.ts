/**
 * Workforce Deep Link Handler
 * Handles vitalcv://workforce/dashboard deep links
 */

export function handleWorkforceDeepLink(url: string): { route: string; params?: Record<string, string> } | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'vitalcv:') {
      return null;
    }

    const path = urlObj.pathname;

    // Handle: vitalcv://workforce/dashboard
    if (path === '/workforce/dashboard' || path.match(/^\/workforce\/dashboard$/)) {
      return {
        route: '/workforce/dashboard',
      };
    }

    // Handle: vitalcv://workforce/unit/:unitId
    const unitMatch = path.match(/^\/workforce\/unit\/(.+)$/);
    if (unitMatch) {
      return {
        route: '/workforce/unit',
        params: { unitId: unitMatch[1] },
      };
    }

    return null;
  } catch (error) {
    console.warn('[WorkforceDeepLink] Failed to parse URL:', error);
    return null;
  }
}

export function setupWorkforceDeepLinkListener(
  callback: (route: string, params?: Record<string, string>) => void,
): () => void {
  // Handle app launch via deep link
  if (typeof window !== 'undefined') {
    const handleDeepLink = (event: MessageEvent) => {
      if (event.data?.type === 'vitalcv-deep-link') {
        const result = handleWorkforceDeepLink(event.data.url);
        if (result) {
          callback(result.route, result.params);
        }
      }
    };

    window.addEventListener('message', handleDeepLink);

    // Also handle direct URL navigation
    const handleUrlChange = () => {
      if (window.location.protocol === 'vitalcv:') {
        const result = handleWorkforceDeepLink(window.location.href);
        if (result) {
          callback(result.route, result.params);
        }
      }
    };

    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('message', handleDeepLink);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }

  return () => {};
}








