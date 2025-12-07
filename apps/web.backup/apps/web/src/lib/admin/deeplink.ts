/**
 * Deep Link Support for Admin Portal
 *
 * Handles vitalcv-admin:// deep links
 */

/**
 * Register deep link handler
 */
export function registerDeepLinkHandler() {
  if (typeof window === 'undefined') {
    return;
  }

  // Handle deep link navigation
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[href^="vitalcv-admin://"]');

    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        handleDeepLink(href);
      }
    }
  });

  // Handle initial deep link on page load
  if (window.location.protocol === 'vitalcv-admin:') {
    handleDeepLink(window.location.href);
  }
}

/**
 * Handle deep link navigation
 */
function handleDeepLink(url: string) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Map deep link paths to routes
    const routeMap: Record<string, string> = {
      '/dashboard': '/portal/dashboard',
      '/users': '/portal/users',
      '/facilities': '/portal/facilities',
      '/chain': '/portal/chain',
      '/ai': '/portal/ai',
      '/analytics': '/portal/analytics',
      '/activity': '/portal/activity',
    };

    const route = routeMap[path] || '/portal/dashboard';
    window.location.href = route;
  } catch (error) {
    console.error('Failed to handle deep link:', error);
  }
}

/**
 * Initialize deep link support
 */
export function initDeepLinkSupport() {
  if (typeof window !== 'undefined') {
    registerDeepLinkHandler();
  }
}

