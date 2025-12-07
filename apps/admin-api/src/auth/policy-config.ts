/**
 * Default AAL Policy Configuration
 *
 * Published JSON configuration for AAL2/AAL3 policies
 * according to NIST SP 800-63B requirements.
 */

export const defaultAalPolicies = {
  /**
   * AAL2 Policy
   * Requires multi-factor authenticator or two separate factors.
   * Phishing-resistant option must be available (but not mandatory).
   */
  aal2: {
    name: 'aal2-default',
    description: 'AAL2: Multi-factor authenticator or two separate factors',
    aalLevel: 2,
    requiresPhishingResistant: false,
    allowedAuthenticatorTypes: ['webauthn', 'totp'],
    config: {
      minAuthenticators: 1,
      timeoutMinutes: 30,
    },
  },

  /**
   * AAL3 Policy
   * Requires device-bound cryptographic authenticator (phishing-resistant).
   * Non-exportable private key required.
   */
  aal3: {
    name: 'aal3-default',
    description: 'AAL3: Device-bound cryptographic authenticator (phishing-resistant)',
    aalLevel: 3,
    requiresPhishingResistant: true,
    allowedAuthenticatorTypes: ['webauthn'],
    config: {
      minAuthenticators: 1,
      requireDeviceBound: true,
      timeoutMinutes: 15,
    },
  },

  /**
   * Admin Default Policy
   * All admin users require AAL3 by default.
   */
  adminDefault: {
    name: 'admin-default',
    description: 'Default policy for admin users - requires AAL3',
    aalLevel: 3,
    requiresPhishingResistant: true,
    allowedAuthenticatorTypes: ['webauthn'],
    config: {
      minAuthenticators: 1,
      requireDeviceBound: true,
      timeoutMinutes: 15,
    },
  },

  /**
   * Verifier Default Policy
   * Verifiers require AAL2 (phishing-resistant option available).
   */
  verifierDefault: {
    name: 'verifier-default',
    description: 'Default policy for verifiers - requires AAL2',
    aalLevel: 2,
    requiresPhishingResistant: false,
    allowedAuthenticatorTypes: ['webauthn', 'totp'],
    config: {
      minAuthenticators: 1,
      timeoutMinutes: 30,
    },
  },
};

/**
 * Export policy configuration as JSON
 */
export function getPolicyJson() {
  return JSON.stringify(defaultAalPolicies, null, 2);
}

