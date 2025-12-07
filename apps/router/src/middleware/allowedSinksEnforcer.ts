/**
 * B97A-SEC-001: Enforce allowed_sinks + detached JWS on inbound routes
 *
 * This middleware enforces that all inbound requests include allowed_sinks.
 * Requests missing allowed_sinks are denied with 403.
 * Audit deny receipts are anchored for compliance.
 */

import { createAllowedSinksEnforcer } from '@vitalcv/messaging-guard';

/**
 * Default allowed_sinks enforcer for router
 */
export const allowedSinksEnforcer = createAllowedSinksEnforcer({
  allowedSinks: process.env.ROUTER_ALLOWED_SINKS?.split(',').filter(Boolean) || [
    'svc.issuer-api',
    'svc.verifier-api',
    'svc.trust-registry',
    'svc.audit-log',
    'etl.fhir-gateway',
  ],
  requireSignature: process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE !== 'false',
  publicKey: process.env.MESSAGING_GUARD_PUBLIC_KEY,
  environment: process.env.NODE_ENV || 'development',
});

// Re-export for convenience
export { createAllowedSinksEnforcer };

