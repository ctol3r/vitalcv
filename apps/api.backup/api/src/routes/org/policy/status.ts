/**
 * B141A-POLICY-007: Policy status API
 * Lists current platform policies and organization acceptance status
 */

import { Router, Request, Response } from 'express';
import {
  getAllActivePolicies,
  getPolicyVersionById,
} from '../../../../../services/policy/models/PlatformPolicyVersion';
import {
  getPolicyAcceptanceStatus,
  recordPolicyAcceptance,
  getOrgPolicyAcceptances,
} from '../../../../../services/policy/models/OrgPolicyAcceptance';
import { requireOrgPermission } from '../../../middleware/requireOrgPermission';

const router = Router();

/**
 * Get current platform policies with acceptance status for organization
 *
 * GET /org/:orgId/policy/status
 *
 * Returns:
 * - List of all active policies
 * - Current version of each policy
 * - Whether organization has accepted each policy
 * - Acceptance details if accepted
 */
router.get(
  '/:orgId/policy/status',
  requireOrgPermission(['org:config:read', 'policy:accept:read'], {
    anyOf: true, // User needs either permission
  }),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      // Get acceptance status for all active policies
      const policyStatuses = await getPolicyAcceptanceStatus(orgId);

      // Group by policy name to show current version
      const policyGroups: Record<string, any> = {};

      for (const status of policyStatuses) {
        const policyName = status.policy.name;

        if (
          !policyGroups[policyName] ||
          new Date(status.policy.effectiveAt) >
            new Date(policyGroups[policyName].currentVersion.effectiveAt)
        ) {
          policyGroups[policyName] = {
            policyName,
            currentVersion: status.policy,
            accepted: status.accepted,
            acceptance: status.acceptance
              ? {
                  acceptedAt: status.acceptance.acceptedAt,
                  acceptedBy: status.acceptance.acceptedBy,
                  acceptedByName: status.acceptance.acceptedByName,
                  anchoredTxHash: status.acceptance.anchoredTxHash,
                }
              : null,
          };
        }
      }

      return res.json({
        orgId,
        policies: Object.values(policyGroups),
        summary: {
          total: Object.keys(policyGroups).length,
          accepted: Object.values(policyGroups).filter((p: any) => p.accepted)
            .length,
          pending: Object.values(policyGroups).filter((p: any) => !p.accepted)
            .length,
        },
      });
    } catch (error) {
      console.error('Get policy status error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve policy status',
      });
    }
  }
);

/**
 * Get specific policy details
 *
 * GET /org/:orgId/policy/:policyId
 *
 * Returns full policy details including content
 */
router.get(
  '/:orgId/policy/:policyId',
  requireOrgPermission(['org:config:read', 'policy:accept:read'], {
    anyOf: true,
  }),
  async (req: Request, res: Response) => {
    try {
      const { policyId } = req.params;

      const policy = await getPolicyVersionById(policyId);

      if (!policy) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Policy version not found',
        });
      }

      return res.json({
        policy: {
          id: policy.id,
          name: policy.name,
          version: policy.version,
          content: policy.content,
          summary: policy.summary,
          effectiveAt: policy.effectiveAt,
          expiresAt: policy.expiresAt,
          isActive: policy.isActive,
          changeNotes: policy.changeNotes,
        },
      });
    } catch (error) {
      console.error('Get policy details error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve policy details',
      });
    }
  }
);

/**
 * Accept a policy on behalf of organization
 *
 * POST /org/:orgId/policy/:policyId/accept
 *
 * Body:
 * - acceptedByName: Name of person accepting (optional)
 * - metadata: Additional acceptance metadata (optional)
 *
 * Records policy acceptance with full audit trail
 */
router.post(
  '/:orgId/policy/:policyId/accept',
  requireOrgPermission(['policy:accept:write']),
  async (req: Request, res: Response) => {
    try {
      const { orgId, policyId } = req.params;
      const { acceptedByName, metadata } = req.body;
      const userId = (req as any).user?.id;
      const userEmail = (req as any).user?.email;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request',
        });
      }

      // Get IP and User-Agent for audit trail
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        undefined;
      const userAgent = req.headers['user-agent'] || undefined;

      // Record acceptance
      const acceptance = await recordPolicyAcceptance(
        orgId,
        policyId,
        userId,
        acceptedByName || userEmail,
        ipAddress,
        userAgent,
        metadata
      );

      return res.status(201).json({
        message: 'Policy accepted successfully',
        acceptance: {
          id: acceptance.id,
          policyName: acceptance.policyVersion.name,
          policyVersion: acceptance.policyVersion.version,
          acceptedAt: acceptance.acceptedAt,
          acceptedBy: acceptance.acceptedBy,
          acceptedByName: acceptance.acceptedByName,
          anchoredTxHash: acceptance.anchoredTxHash,
        },
      });
    } catch (error: any) {
      console.error('Accept policy error:', error);

      if (error.message?.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error.message?.includes('inactive')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to accept policy',
      });
    }
  }
);

/**
 * Get organization's policy acceptance history
 *
 * GET /org/:orgId/policy/acceptances
 *
 * Returns all policy acceptances for the organization
 */
router.get(
  '/:orgId/policy/acceptances',
  requireOrgPermission(['org:config:read', 'audit:export:read'], {
    anyOf: true,
  }),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const acceptances = await getOrgPolicyAcceptances(orgId);

      return res.json({
        orgId,
        acceptances: acceptances.map((a) => ({
          id: a.id,
          policy: {
            id: a.policyVersion.id,
            name: a.policyVersion.name,
            version: a.policyVersion.version,
            summary: a.policyVersion.summary,
            effectiveAt: a.policyVersion.effectiveAt,
          },
          acceptedAt: a.acceptedAt,
          acceptedBy: a.acceptedBy,
          acceptedByName: a.acceptedByName,
          anchoredTxHash: a.anchoredTxHash,
        })),
        count: acceptances.length,
      });
    } catch (error) {
      console.error('Get policy acceptances error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve policy acceptances',
      });
    }
  }
);

export default router;

