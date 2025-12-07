/**
 * DC-010: Chrome Digital Credentials API Integration
 * Provides functions to store, list, and present VitalCV credentials via Chrome's Digital Credentials API
 */

export interface DigitalCredential {
  id: string;
  type: string[];
  issuer: string;
  credentialSubject: Record<string, any>;
  issuanceDate?: string;
  expirationDate?: string;
}

export interface PresentationRequest {
  url: string;
  nonce?: string;
  state?: string;
}

/**
 * Check if Chrome Digital Credentials API is available
 */
export function isChromeDigitalCredentialsAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for navigator.identity API (Chrome's Digital Credentials API)
  return typeof (navigator as any).identity !== 'undefined' &&
         typeof (navigator.identity as any).get === 'function' &&
         typeof (navigator.identity as any).store === 'function';
}

/**
 * Store a credential in Chrome's Digital Credentials wallet
 */
export async function storeCredential(
  credential: DigitalCredential
): Promise<{ success: boolean; error?: string }> {
  if (!isChromeDigitalCredentialsAvailable()) {
    return {
      success: false,
      error: 'Chrome Digital Credentials API is not available. Please use Chrome browser with Digital Credentials enabled.',
    };
  }

  try {
    // Chrome's identity API expects credentials in W3C VC format
    const credentialRequest = {
      digitalCredential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: credential.type,
        issuer: credential.issuer,
        credentialSubject: credential.credentialSubject,
        issuanceDate: credential.issuanceDate || new Date().toISOString(),
        ...(credential.expirationDate && { expirationDate: credential.expirationDate }),
      },
    };

    await (navigator.identity as any).store(credentialRequest);

    return { success: true };
  } catch (error) {
    console.error('[Chrome Digital Credentials] Store error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store credential',
    };
  }
}

/**
 * List all credentials stored in Chrome's Digital Credentials wallet
 */
export async function listCredentials(): Promise<{
  success: boolean;
  credentials?: DigitalCredential[];
  error?: string;
}> {
  if (!isChromeDigitalCredentialsAvailable()) {
    return {
      success: false,
      error: 'Chrome Digital Credentials API is not available',
    };
  }

  try {
    // Note: Chrome's identity API may not have a direct list method
    // This is a placeholder for future API capabilities
    // For now, we'll return an empty array and log a warning
    console.warn('[Chrome Digital Credentials] List API not yet available in Chrome');
    return {
      success: true,
      credentials: [],
    };
  } catch (error) {
    console.error('[Chrome Digital Credentials] List error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list credentials',
    };
  }
}

/**
 * Present credentials in response to an OID4VP request
 */
export async function presentCredentials(
  request: PresentationRequest
): Promise<{
  success: boolean;
  vpToken?: string;
  error?: string;
}> {
  if (!isChromeDigitalCredentialsAvailable()) {
    return {
      success: false,
      error: 'Chrome Digital Credentials API is not available. Please use Chrome browser or fallback to QR/download options.',
    };
  }

  try {
    // Parse the OID4VP request URL to extract presentation_definition
    const url = new URL(request.url);
    const presentationDefinition = url.searchParams.get('presentation_definition');

    if (!presentationDefinition) {
      return {
        success: false,
        error: 'Invalid presentation request: missing presentation_definition',
      };
    }

    const pd = JSON.parse(presentationDefinition);

    // Create credential request for Chrome's identity.get() API
    const credentialRequest = {
      digitalCredentials: {
        // Map presentation_definition input_descriptors to credential filters
        filters: pd.input_descriptors?.map((desc: any) => ({
          type: desc.format?.jwt_vc || desc.format?.jwt_vc_json,
        })) || [],
      },
      requestUrl: request.url,
    };

    // Call Chrome's identity.get() to present credentials
    const result = await (navigator.identity as any).get(credentialRequest);

    if (!result || !result.digitalCredential) {
      return {
        success: false,
        error: 'No credential was selected or presented',
      };
    }

    // Extract VP token from the result
    // The format may vary based on Chrome's implementation
    const vpToken = result.digitalCredential?.vpToken ||
                   result.vpToken ||
                   JSON.stringify(result.digitalCredential);

    return {
      success: true,
      vpToken,
    };
  } catch (error) {
    console.error('[Chrome Digital Credentials] Present error:', error);

    // Check if user cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'User cancelled credential presentation',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to present credentials',
    };
  }
}

/**
 * Get user-friendly error message for when API is not available
 */
export function getUnavailableMessage(): string {
  return 'Chrome Digital Credentials API is not available in this browser. Please use Chrome with Digital Credentials enabled, or use the QR code or download options instead.';
}

