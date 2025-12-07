/**
 * B121A-AGOV-009: Agent governance: signed request enforcement
 *
 * Middleware that enforces signed requests for agent operations:
 * - unsigned→403: Rejects unsigned requests with 403 Forbidden
 * - audit proof anchored: Logs all requests with cryptographic proof
 * - config whitelist respected: Validates against tool allowlist
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAgentMessage, auditAgentMessage, SignedAgentMessage, VerificationResult } from './signed-messaging';
import { ToolAllowlistManager, AgentToolCall } from './tool-allowlist';
import { createHash } from 'crypto';

/**
 * B121A-AGOV-009: Agent governance middleware configuration
 */
export interface AgentGovernanceConfig {
  /** Require signed requests (default: true) */
  requireSignature: boolean;
  /** Tool allowlist manager */
  toolAllowlistManager: ToolAllowlistManager;
  /** Public key for signature verification (Ed25519) */
  publicKey: Buffer;
  /** Whitelist of agent IDs allowed (empty = all agents) */
  agentWhitelist?: string[];
  /** Enable audit anchoring (default: true) */
  enableAuditAnchoring: boolean;
}

/**
 * B121A-AGOV-009: Agent governance middleware
 * Enforces signed requests, validates allowlist, and anchors audit proofs
 */
export function createAgentGovernanceMiddleware(config: AgentGovernanceConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signedMessage = req.body as SignedAgentMessage;

      // B121A-AGOV-009: Check if request is signed
      if (!signedMessage || !signedMessage.signature) {
        if (config.requireSignature) {
          // B121A-AGOV-009: unsigned→403
          const auditProof = createAuditProof(req, 'unsigned_request');
          await anchorAuditProof(auditProof, config.enableAuditAnchoring);

          return res.status(403).json({
            error: 'unsigned_request',
            error_description: 'Agent requests must be signed. Provide signature in request body.',
            auditProof: config.enableAuditAnchoring ? auditProof.hash : undefined,
          });
        }
      }

      // B121A-AGOV-009: Verify signature if present
      if (signedMessage.signature && config.requireSignature) {
        const verificationResult = verifyAgentMessage(signedMessage, config.publicKey);

        if (!verificationResult.valid) {
          const auditProof = createAuditProof(req, 'signature_verification_failed', {
            error: verificationResult.error,
          });
          await anchorAuditProof(auditProof, config.enableAuditAnchoring);

          return res.status(403).json({
            error: 'signature_verification_failed',
            error_description: verificationResult.error || 'Signature verification failed',
            auditProof: config.enableAuditAnchoring ? auditProof.hash : undefined,
          });
        }

        // B121A-AGOV-009: Audit proof anchored
        await auditAgentMessage(signedMessage, verificationResult, {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      // B121A-AGOV-009: Validate agent whitelist
      if (config.agentWhitelist && config.agentWhitelist.length > 0) {
        const agentId = signedMessage.headers?.agentId || signedMessage.agentId;
        if (!agentId || !config.agentWhitelist.includes(agentId)) {
          const auditProof = createAuditProof(req, 'agent_not_whitelisted', {
            agentId,
            whitelist: config.agentWhitelist,
          });
          await anchorAuditProof(auditProof, config.enableAuditAnchoring);

          return res.status(403).json({
            error: 'agent_not_whitelisted',
            error_description: `Agent '${agentId}' is not in the whitelist`,
            auditProof: config.enableAuditAnchoring ? auditProof.hash : undefined,
          });
        }
      }

      // B121A-AGOV-009: Validate tool allowlist
      const toolCall: AgentToolCall = {
        agentId: signedMessage.headers?.agentId || signedMessage.agentId,
        tool: signedMessage.toolCall?.tool || req.body.tool,
        params: signedMessage.toolCall?.params || req.body.params || {},
        purpose: signedMessage.purpose || req.body.purpose,
        timestamp: signedMessage.timestamp || req.body.timestamp || Date.now(),
      };

      const allowlistResult = config.toolAllowlistManager.validateToolCall(toolCall);
      if (!allowlistResult.allowed) {
        const auditProof = createAuditProof(req, 'tool_call_blocked', {
          reason: allowlistResult.reason,
          toolCall,
        });
        await anchorAuditProof(auditProof, config.enableAuditAnchoring);

        return res.status(403).json({
          error: 'tool_call_blocked',
          error_description: allowlistResult.reason,
          auditProof: config.enableAuditAnchoring ? auditProof.hash : undefined,
        });
      }

      // Attach validated data to request
      (req as any).agentMessage = signedMessage;
      (req as any).toolCall = toolCall;
      (req as any).governanceValidated = true;

      next();
    } catch (error) {
      const auditProof = createAuditProof(req, 'governance_error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      await anchorAuditProof(auditProof, config.enableAuditAnchoring);

      res.status(500).json({
        error: 'governance_error',
        error_description: error instanceof Error ? error.message : 'Agent governance check failed',
        auditProof: config.enableAuditAnchoring ? auditProof.hash : undefined,
      });
    }
  };
}

/**
 * B121A-AGOV-009: Create audit proof with cryptographic hash
 */
function createAuditProof(
  req: Request,
  event: string,
  context?: Record<string, any>
): { hash: string; timestamp: string; event: string; context: Record<string, any> } {
  const timestamp = new Date().toISOString();
  const proofData = {
    event,
    timestamp,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
    ...context,
  };

  const hash = createHash('sha256')
    .update(JSON.stringify(proofData))
    .digest('hex');

  return {
    hash,
    timestamp,
    event,
    context: proofData,
  };
}

/**
 * B121A-AGOV-009: Anchor audit proof (in production, persist to database/blockchain)
 */
async function anchorAuditProof(
  proof: { hash: string; timestamp: string; event: string; context: Record<string, any> },
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    return;
  }

  // B121A-AGOV-009: Log audit proof (in production, persist to database/blockchain)
  console.info('[AUDIT PROOF]', {
    hash: proof.hash,
    timestamp: proof.timestamp,
    event: proof.event,
    context: proof.context,
  });

  // TODO: In production, persist to database:
  // await prisma.auditProof.create({
  //   data: {
  //     hash: proof.hash,
  //     timestamp: new Date(proof.timestamp),
  //     event: proof.event,
  //     context: proof.context,
  //   },
  // });

  // TODO: In production, anchor to blockchain for immutable audit trail
  // await anchorToBlockchain(proof.hash, proof.timestamp);
}

