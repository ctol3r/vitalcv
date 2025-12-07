/**
 * B109C-ALLOW-035: Enforce allowed_sinks + detached JWS on inbound routes
 *
 * This middleware enforces that all inbound requests include allowed_sinks.
 * Requests missing allowed_sinks are denied with 403.
 * Audit deny receipts are anchored for compliance.
 */

import { createAllowedSinksEnforcer } from '@vitalcv/messaging-guard';

/**
 * Default allowed_sinks enforcer for admin-api
 */
export const allowedSinksEnforcer = createAllowedSinksEnforcer({
  allowedSinks: process.env.ADMIN_API_ALLOWED_SINKS?.split(',').filter(Boolean) || [
    'svc.admin-api',
    'svc.router',
  ],
  requireSignature: process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE !== 'false',
  publicKey: process.env.MESSAGING_GUARD_PUBLIC_KEY,
  environment: process.env.NODE_ENV || 'development',
});

// Re-export for convenience
export { createAllowedSinksEnforcer };

