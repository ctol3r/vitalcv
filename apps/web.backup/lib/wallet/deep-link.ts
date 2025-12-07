/**
 * Deep Link Handler
 * Handles vitalcv://wallet/:id deep links
 */

export function handleWalletDeepLink(url: string): { credentialId: string } | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'vitalcv:') {
      return null;
    }

    const path = urlObj.pathname;
    const match = path.match(/^\/wallet\/(.+)$/);

    if (match) {
      return {
        credentialId: match[1],
      };
    }

    return null;
  } catch (error) {
    console.warn('[DeepLink] Failed to parse URL:', error);
    return null;
  }
}

export function setupDeepLinkListener(
  callback: (credentialId: string) => void
): () => void {
  // Handle app launch via deep link
  if (typeof window !== 'undefined') {
    const handleDeepLink = (event: MessageEvent) => {
      if (event.data?.type === 'vitalcv-deep-link') {
        const result = handleWalletDeepLink(event.data.url);
        if (result) {
          callback(result.credentialId);
        }
      }
    };

    window.addEventListener('message', handleDeepLink);

    return () => {
      window.removeEventListener('message', handleDeepLink);
    };
  }

  return () => {};
}








