import express, { Request, Response } from 'express';
import { z } from 'zod';
import {
  attachAutoAnalysisResult,
  createOrgOnboardingRequest,
} from '../../../../../services/org/models/OrgOnboardingRequest.js';
import agentRouter, { TaskSpec } from '../../../../../services/agents/router.js';
import { AgentScope, RiskTier } from '../../../../../services/agents/registry.js';

const router = express.Router();

const PrivilegePayloadSchema = z.union([
  z.string().min(1),
  z.object({
    code: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
]);

const InvitePayloadSchema = z.object({
  clinicianId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  requiredPrivileges: z.array(PrivilegePayloadSchema).min(1),
  privilegeNotes: z.string().max(2000).optional(),
  ehrSystem: z.string().min(1),
  ehrConfiguration: z.record(z.any()).optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/:orgId/onboarding/invite', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const parsed = InvitePayloadSchema.parse(req.body);

    const onboardingRequest = await createOrgOnboardingRequest({
      clinicianId: parsed.clinicianId,
      orgId,
      requestedBy: parsed.requestedBy,
      requiredPrivileges: parsed.requiredPrivileges,
      privilegeNotes: parsed.privilegeNotes,
      ehrSystem: parsed.ehrSystem,
      ehrConfiguration: parsed.ehrConfiguration,
      notes: parsed.notes,
      metadata: parsed.metadata,
    });

    const analysis = await triggerAutoAnalysis(onboardingRequest);

    res.status(201).json({
      request: onboardingRequest,
      autoAnalysis: analysis,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'validation_error',
        details: error.errors,
      });
      return;
    }

    console.error('Failed to invite clinician to org onboarding', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create onboarding request',
    });
  }
});

async function triggerAutoAnalysis(request: Awaited<ReturnType<typeof createOrgOnboardingRequest>>) {
  const taskSpec: TaskSpec = {
    id: `org-onboarding-${request.id}`,
    name: 'Org onboarding auto-analysis',
    description: `Analyze onboarding request ${request.id} for clinician ${request.clinicianId}`,
    requiredCapabilities: ['analysis', 'credentialing'],
    requiredScopes: [AgentScope.READ],
    riskLevel: RiskTier.MEDIUM,
    priority: 'high',
    metadata: {
      requestId: request.id,
      orgId: request.orgId,
      clinicianId: request.clinicianId,
      privileges: request.requiredPrivileges,
      ehrSystem: request.ehrSystem,
    },
  };

  try {
    const routing = await agentRouter.route(taskSpec);
    const normalizedRouting = {
      ...routing,
      timestamp:
        routing.timestamp instanceof Date
          ? routing.timestamp.toISOString()
          : routing.timestamp,
    };
    await attachAutoAnalysisResult(request.id, {
      taskId: routing.taskId,
      result: normalizedRouting,
    });
    return normalizedRouting;
  } catch (error) {
    console.error('Agent auto-analysis failed for onboarding request', {
      requestId: request.id,
      error,
    });
    return null;
  }
}

export default router;

