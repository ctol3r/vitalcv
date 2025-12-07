import express, { Request, Response } from 'express';
import { createGuardMiddleware, AuditEvent } from '@vitalcv/messaging-guard';

const router = express.Router();

// Audit event emitter
const emitAudit = async (event: AuditEvent) => {
  console.log('[AUDIT]', JSON.stringify(event));
  // TODO: Emit to audit service
};

// Guard middleware for OIDC4VCI routes
export const oidc4vciGuard = createGuardMiddleware({
  allowedSinks: ['svc.issuer-api'],
  requireSignature: process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE !== 'false',
  publicKey: process.env.MESSAGING_GUARD_PUBLIC_KEY,
  environment: process.env.NODE_ENV || 'development', // Env-scoped enforcement
  emitAudit,
});

export default router;

