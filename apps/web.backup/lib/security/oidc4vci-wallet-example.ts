/**
 * B104A-FE-003: OIDC4VCI Wallet Client Usage Example
 *
 * Example usage of the OIDC4VCI wallet client with DPoP
 */

import { createOIDC4VCIWalletClient } from '@/lib/security/oidc4vci-wallet';

/**
 * Example: Request a credential using OIDC4VCI with DPoP
 */
export async function exampleRequestCredential() {
  try {
    // Initialize wallet client
    const issuerUrl = process.env.NEXT_PUBLIC_ISSUER_URL || 'https://vitalcv.ai';
    const accessToken = 'your-access-token-here'; // From token exchange

    const wallet = createOIDC4VCIWalletClient(issuerUrl, accessToken);

    // Discover issuer metadata
    const metadata = await wallet.discoverIssuer();
    console.log('Issuer supports formats:', metadata.formats_supported);

    // Request credential
    const credentialResponse = await wallet.requestCredential({
      format: 'jwt_vc_json',
      types: ['VerifiableCredential', 'PhysicianCredential'],
      subject_id: 'did:example:subject',
    });

    if (credentialResponse.credential) {
      console.log('Credential issued:', credentialResponse.credential);
    } else if (credentialResponse.transaction_id) {
      console.log('Deferred issuance, transaction ID:', credentialResponse.transaction_id);
      // Poll for deferred credential
      const deferredCredential = await wallet.getDeferredCredential(
        credentialResponse.transaction_id
      );
      console.log('Deferred credential:', deferredCredential.credential);
    }
  } catch (error) {
    console.error('Credential request failed:', error);
    // Error is automatically surfaced via 'oidc4vci-wallet-error' event
  }
}

/**
 * Example: Listen for DPoP and OIDC4VCI errors
 */
export function setupErrorHandlers() {
  if (typeof window === 'undefined') return;

  // Listen for DPoP errors
  window.addEventListener('dpop-error', (event: CustomEvent) => {
    console.error('DPoP error:', event.detail);
    // Show user-friendly error message
    alert(`DPoP Error: ${event.detail.message}`);
  });

  // Listen for OIDC4VCI wallet errors
  window.addEventListener('oidc4vci-wallet-error', (event: CustomEvent) => {
    console.error('OIDC4VCI wallet error:', event.detail);
    // Show user-friendly error message
    const message = event.detail.code === 'USE_DPOP'
      ? 'DPoP proof required. Please ensure your wallet supports DPoP.'
      : `Wallet Error: ${event.detail.message}`;
    alert(message);
  });
}

