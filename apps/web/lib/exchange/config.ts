/**
 * Trust Exchange runtime config (Wave 800, C7)
 * ──────────────────────────────────────────────────────────────────────────
 * Resolves the federation shared secret and the demo federation registry.
 *
 * Production note: a single shared secret is a DEMO posture. Real deployments
 * issue per-member secrets and rotate them out-of-band; this module is the seam
 * where that wiring lands. It fails closed in production if no secret is set.
 */
import type { FederationRegistry } from './federation';

const DEV_FALLBACK_SECRET = 'vitalcv-dev-trust-exchange-secret';

/**
 * The federation secret. In production (`NODE_ENV==='production'`) a configured
 * `TRUST_EXCHANGE_SECRET` is REQUIRED — we throw rather than sign/verify with a
 * guessable default. Outside production a deterministic dev fallback is used.
 */
export function exchangeSecret(): string {
  const configured = process.env.TRUST_EXCHANGE_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TRUST_EXCHANGE_SECRET is not configured; refusing to use a default secret in production.');
  }
  return DEV_FALLBACK_SECRET;
}

/** The demo federation: one issuing org, one verifying org, one that does both. */
export function demoFederation(): FederationRegistry {
  return {
    federationId: 'vitalcv-demo-federation',
    members: [
      { orgKey: 'org-mercy-health', name: 'Mercy Health System', roles: ['issuer'] },
      { orgKey: 'org-coastal-staffing', name: 'Coastal Staffing Network', roles: ['verifier'] },
      { orgKey: 'org-vitalcv-network', name: 'VitalCV Network', roles: ['issuer', 'verifier'] },
    ],
  };
}
