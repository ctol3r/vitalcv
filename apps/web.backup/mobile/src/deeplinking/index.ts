import { Linking } from 'react-native';

/**
 * Parse and handle deep links
 * Scheme: vitalcv://
 * Supported routes:
 * - present?nonce=<nonce>  (OIDC4VP presentation request)
 */

export const handleDeepLink = (url: string | null) => {
  if (!url) return;

  console.log('Deep link received:', url);

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === 'vitalcv:') {
      const path = parsedUrl.pathname.replace('//', ''); // handle some weird parsing cases
      const hostname = parsedUrl.hostname;

      // Handle: vitalcv://present
      if (hostname === 'present' || path === 'present') {
        const nonce = parsedUrl.searchParams.get('nonce');
        if (nonce) {
          handlePresentationRequest(nonce);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing deep link:', error);
  }
};

const handlePresentationRequest = (nonce: string) => {
  console.log('Handling presentation request with nonce:', nonce);
  // TODO: Navigate to presentation screen or trigger presentation logic
};

/**
 * Initialize deep linking listeners
 */
export const initializeDeepLinking = () => {
  // Handle app launch from deep link
  Linking.getInitialURL().then(handleDeepLink);

  // Handle deep links while app is running
  const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

  return () => {
    subscription.remove();
  };
};














