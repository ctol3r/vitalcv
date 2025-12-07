/**
 * Deep Link Handler for vitalcv://verifier/dashboard
 * Handles custom URL scheme redirects to the dashboard
 */

export function handleDeepLink(url: string): string | null {
  // Parse vitalcv:// URLs
  if (url.startsWith('vitalcv://')) {
    const path = url.replace('vitalcv://', '');

    // Map deep link paths to Next.js routes
    if (path.startsWith('verifier/dashboard')) {
      return '/verifier/dashboard';
    }

    // Handle with query params
    if (path.includes('?')) {
      const [route, query] = path.split('?');
      if (route === 'verifier/dashboard') {
        return `/verifier/dashboard?${query}`;
      }
    }
  }

  return null;
}

// Client-side deep link handler
if (typeof window !== 'undefined') {
  // Listen for deep link events (if using a mobile wrapper)
  window.addEventListener('vitalcv-deeplink', ((e: CustomEvent) => {
    const url = e.detail.url;
    const route = handleDeepLink(url);
    if (route) {
      window.location.href = route;
    }
  }) as EventListener);
}

