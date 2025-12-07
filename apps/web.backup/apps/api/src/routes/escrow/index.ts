import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../../services/audit/anchor';
import {
  CONTRACT_MILESTONES,
  buildMilestoneStates,
  markContractMilestone,
  type ContractMilestone,
} from '../../services/contracts/milestones';
import { generateContractReceipt } from '../../services/contracts/receipt';

const prisma = new PrismaClient();
const router = Router();

router.post('/escrow/lock', async (req: Request, res: Response) => {
  try {
    const clinicianId = sanitizeString(req.body?.clinicianId);
    const employerId = sanitizeString(req.body?.employerId);
    const amount = sanitizeNumber(req.body?.amount);
    const currency = (sanitizeString(req.body?.currency) ?? 'USD').toUpperCase();
    const metadata = buildMetadata(req.body?.metadata);

    if (!clinicianId || !employerId || !amount) {
      return res.status(400).json({ error: 'validation_error' });
    }

    const contract = await prisma.contractEscrow.create({
      data: {
        clinicianId,
        employerId,
        amount,
        currency,
        status: 'locked',
        metadata,
      },
    });

    anchorEvent('contractLock', {
      contractId: contract.id,
      clinicianId,
      employerId,
      amount,
      currency,
    });

    const receipt = generateContractReceipt(contract);
    const enriched = {
      ...contract,
      milestones: buildMilestoneStates(contract.metadata),
    };

    return res.status(201).json({
      contract: enriched,
      receipt,
    });
  } catch (error) {
    console.error('[escrow] lock failed', error);
    return res.status(500).json({ error: 'escrow_lock_failed' });
  }
});

router.get('/escrow/contracts', async (req: Request, res: Response) => {
  try {
    const employerId = typeof req.query.employerId === 'string' ? req.query.employerId : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const contracts = await prisma.contractEscrow.findMany({
      where: {
        ...(employerId ? { employerId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({
      contracts: contracts.map((contract) => ({
        ...contract,
        milestones: buildMilestoneStates(contract.metadata),
      })),
    });
  } catch (error) {
    console.error('[escrow] list failed', error);
    return res.status(500).json({ error: 'escrow_list_failed' });
  }
});

router.post('/escrow/:contractId/release', async (req: Request, res: Response) => {
  return transitionContract(req, res, 'released', 'contractRelease');
});

router.post('/escrow/:contractId/refund', async (req: Request, res: Response) => {
  return transitionContract(req, res, 'refunded', 'contractRefund');
});

router.post('/escrow/:contractId/milestones', async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId;
    const milestone = req.body?.milestone as ContractMilestone;
    const actor = sanitizeString(req.body?.actor) ?? 'escrow-console';
    const evidence = sanitizeString(req.body?.evidence) ?? undefined;

    if (!CONTRACT_MILESTONES.some((entry) => entry.key === milestone)) {
      return res.status(400).json({ error: 'invalid_milestone' });
    }

    const result = await markContractMilestone(
      {
        contractId,
        milestone,
        actor,
        evidence,
      },
      { prisma },
    );

    return res.json({
      contract: {
        ...result.contract,
        milestones: result.milestones,
      },
      autoReleased: result.autoReleased,
    });
  } catch (error) {
    console.error('[escrow] milestone update failed', error);
    return res.status(500).json({ error: 'escrow_milestone_failed' });
  }
});

async function transitionContract(
  req: Request,
  res: Response,
  nextStatus: 'released' | 'refunded',
  anchorType: 'contractRelease' | 'contractRefund',
) {
  try {
    const contractId = req.params.contractId;
    const contract = await prisma.contractEscrow.findUnique({ where: { id: contractId } });
    if (!contract) {
      return res.status(404).json({ error: 'contract_not_found' });
    }
    if (contract.status === nextStatus) {
      return res.status(409).json({ error: 'already_transitioned', contract });
    }

    const updated = await prisma.contractEscrow.update({
      where: { id: contractId },
      data: { status: nextStatus },
    });

    anchorEvent(anchorType, {
      contractId: updated.id,
      clinicianId: updated.clinicianId,
      employerId: updated.employerId,
      amount: updated.amount,
      currency: updated.currency,
    });

    const receipt = generateContractReceipt(updated);
    const enriched = {
      ...updated,
      milestones: buildMilestoneStates(updated.metadata),
    };

    return res.json({
      contract: enriched,
      receipt,
    });
  } catch (error) {
    console.error('[escrow] transition failed', error);
    return res.status(500).json({ error: 'escrow_transition_failed' });
  }
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeNumber(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num);
}

function buildMetadata(metadata: unknown): Prisma.JsonValue | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  return metadata as Prisma.JsonValue;
}

export default router;


