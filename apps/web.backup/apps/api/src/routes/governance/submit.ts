import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  buildGovernanceTimeline,
  castVote,
  GovernanceGuardrailError,
  listProposals,
  queryProposal,
  submitProposal,
} from '../../services/governance/bridge';

const router = Router();

const ImpactSchema = z
  .object({
    securityPolicy: z.enum(['strengthened', 'unchanged', 'relaxed']).optional(),
    auditAnchoring: z.enum(['required', 'optional', 'disabled']).optional(),
    revocationChecks: z.enum(['required', 'optional', 'bypass']).optional(),
  })
  .partial();

const BlockTimeChangeSchema = z.object({
  type: z.literal('blockTimeTuning'),
  params: z.object({
    targetMilliseconds: z.number().int().positive(),
    minMilliseconds: z.number().int().positive().optional(),
    maxMilliseconds: z.number().int().positive().optional(),
  }),
  impact: ImpactSchema.optional(),
});

const ValidatorWeightsSchema = z.object({
  type: z.literal('validatorWeights'),
  params: z.object({
    weights: z
      .array(
        z.object({
          validator: z.string().min(1),
          weight: z.number().positive(),
        }),
      )
      .min(1),
    rebalance: z.boolean().optional(),
  }),
  impact: ImpactSchema.optional(),
});

const AuditRetentionSchema = z.object({
  type: z.literal('auditRetentionPolicies'),
  params: z.object({
    retentionDays: z.number().int().positive(),
    coldStorageDays: z.number().int().positive().optional(),
    anchorEveryMinutes: z.number().int().positive().optional(),
  }),
  impact: ImpactSchema.optional(),
});

const ChangeSetSchema = z.discriminatedUnion('type', [
  BlockTimeChangeSchema,
  ValidatorWeightsSchema,
  AuditRetentionSchema,
]);

const SubmitSchema = z.object({
  proposerDid: z.string().min(4),
  title: z.string().min(3),
  description: z.string().min(10),
  changeSet: ChangeSetSchema,
});

const VoteSchema = z.object({
  voterDid: z.string().min(4),
  vote: z.enum(['yes', 'no', 'abstain']),
});

router.get('/governance/proposals', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 25) || 25, 100);
  try {
    const proposals = await listProposals(limit);
    const timeline = buildGovernanceTimeline(proposals);
    return res.json({
      proposals,
      timeline,
    });
  } catch (error) {
    console.error('[governance][list] failed', error);
    return res.status(500).json({
      error: 'governance_list_failed',
      message: error instanceof Error ? error.message : 'Unable to list proposals',
    });
  }
});

router.get('/governance/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const proposal = await queryProposal(req.params.proposalId);
    return res.json({
      proposal,
      timeline: buildGovernanceTimeline([proposal]),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'proposal_not_found') {
      return res.status(404).json({ error: 'not_found', message: 'Proposal not found' });
    }
    console.error('[governance][get] failed', error);
    return res.status(500).json({
      error: 'governance_get_failed',
      message: error instanceof Error ? error.message : 'Unable to load proposal',
    });
  }
});

router.post('/governance/proposals', createProposalHandler);
router.post('/governance/submit', createProposalHandler);

async function createProposalHandler(req: Request, res: Response): Promise<Response> {
  const parsed = SubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_payload',
      details: parsed.error.flatten(),
    });
    return res;
  }

  try {
    const proposal = await submitProposal(parsed.data);
    res.status(201).json({ proposal });
  } catch (error) {
    if (error instanceof GovernanceGuardrailError) {
      res.status(422).json({
        error: error.code,
        message: error.message,
      });
      return res;
    }
    console.error('[governance][submit] failed', error);
    res.status(500).json({
      error: 'governance_submit_failed',
      message: error instanceof Error ? error.message : 'Unable to submit proposal',
    });
  }
  return res;
}

router.post(
  '/governance/proposals/:proposalId/votes',
  async (req: Request, res: Response): Promise<Response | void> => {
    const parsed = VoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    try {
      const proposal = await castVote({
        proposalId: req.params.proposalId,
        voterDid: parsed.data.voterDid,
        vote: parsed.data.vote,
      });
      return res.status(200).json({ proposal });
    } catch (error) {
      if (error instanceof Error && error.message === 'proposal_not_found') {
        return res.status(404).json({ error: 'not_found', message: 'Proposal not found' });
      }
      console.error('[governance][vote] failed', error);
      return res.status(500).json({
        error: 'governance_vote_failed',
        message: error instanceof Error ? error.message : 'Unable to cast vote',
      });
    }
  },
);

export default router;


