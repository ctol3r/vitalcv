import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createWorkflowDraft,
  requestSignatures,
  recordPartialSignature,
  revokeMultiPartyCredential,
  listWorkflows,
  getWorkflow,
  type MultiPartyWorkflowRecord,
} from '../../services/issuer/multi-party-workflow';

const router = Router();

const InviteSchema = z.object({
  baseCredentialId: z.string().min(1),
  participantDids: z.array(z.string().min(1)).min(2),
  requestedBy: z.string().min(1),
  summary: z.string().optional(),
});

const AcceptSchema = z.object({
  multiCredentialId: z.string().min(1),
  issuerDid: z.string().min(1),
  proof: z.record(z.any()),
  signedAt: z.string().optional(),
  summary: z.string().optional(),
  anchor: z
    .object({
      txHash: z.string().min(6),
      timestamp: z.string().min(4),
      network: z.string().optional(),
    })
    .optional(),
});

const RevokeSchema = z.object({
  revokedBy: z.string().min(1),
  reason: z.string().min(3),
});

router.post('/multi/invite', async (req: Request, res: Response) => {
  const parsed = InviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  try {
    const draft = await createWorkflowDraft(parsed.data);
    const workflow = await requestSignatures(draft.id, parsed.data.requestedBy, parsed.data.summary);
    return res.status(201).json({ workflow: serializeWorkflow(workflow) });
  } catch (error) {
    console.error('[issuer][multi][invite]', error);
    return res.status(500).json({
      error: 'multi_party_invite_failed',
      message: error instanceof Error ? error.message : 'Unable to enqueue invites',
    });
  }
});

router.post('/multi/accept', async (req: Request, res: Response) => {
  const parsed = AcceptSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  try {
    const workflow = await recordPartialSignature(parsed.data);
    return res.status(200).json({ workflow: serializeWorkflow(workflow) });
  } catch (error) {
    console.error('[issuer][multi][accept]', error);
    return res.status(400).json({
      error: 'partial_signature_failed',
      message: error instanceof Error ? error.message : 'Unable to record partial signature',
    });
  }
});

router.post('/multi/:id/revoke', async (req: Request, res: Response) => {
  const parsed = RevokeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  try {
    const workflow = await revokeMultiPartyCredential({
      multiCredentialId: req.params.id,
      revokedBy: parsed.data.revokedBy,
      reason: parsed.data.reason,
    });
    return res.status(200).json({ workflow: serializeWorkflow(workflow) });
  } catch (error) {
    console.error('[issuer][multi][revoke]', error);
    return res.status(400).json({
      error: 'revocation_failed',
      message: error instanceof Error ? error.message : 'Unable to revoke multi-party credential',
    });
  }
});

router.get('/multi', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 25);
  try {
    const workflows = await listWorkflows(limit);
    return res.status(200).json({
      workflows: workflows.map(serializeWorkflow),
    });
  } catch (error) {
    console.error('[issuer][multi][list]', error);
    return res.status(500).json({
      error: 'fetch_failed',
      message: error instanceof Error ? error.message : 'Unable to list multi-party workflows',
    });
  }
});

router.get('/multi/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await getWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.status(200).json({ workflow: serializeWorkflow(workflow) });
  } catch (error) {
    console.error('[issuer][multi][detail]', error);
    return res.status(500).json({
      error: 'fetch_failed',
      message: error instanceof Error ? error.message : 'Unable to load workflow',
    });
  }
});

function serializeWorkflow(record: MultiPartyWorkflowRecord) {
  return {
    id: record.id,
    baseCredentialId: record.baseCredentialId,
    participantDids: record.participantDids,
    status: record.status,
    rootHash: record.rootHash ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    threadId: record.threadId,
    activity: record.activityLog,
    signatures: record.signatures,
    jointCredential: record.jointCredential ?? null,
  };
}

export default router;









