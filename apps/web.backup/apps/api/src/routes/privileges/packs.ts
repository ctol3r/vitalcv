import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrivilegeEvaluator } from '../../services/privileges/evaluator';
import { generatePrivilegePacket } from '../../services/privileges/packet';
import { buildCredentialGraph } from '../../services/privileges/graph';

const prisma = new PrismaClient();
const router = Router();
const evaluator = new PrivilegeEvaluator();

router.get('/privileges/packs/:packId', async (req: Request, res: Response) => {
  try {
    const pack = await prisma.privilegePack.findUnique({
      where: { id: req.params.packId },
    });
    if (!pack) {
      return res.status(404).json({ error: 'privilege_pack_not_found' });
    }
    return res.json(pack);
  } catch (error) {
    console.error('[privileges] pack fetch failed', error);
    return res.status(500).json({ error: 'privilege_pack_fetch_failed' });
  }
});

router.put('/privileges/packs/:packId', async (req: Request, res: Response) => {
  try {
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim().length ? req.body.name.trim() : undefined;
    const rules = req.body?.rules;

    if (!name && !rules) {
      return res.status(400).json({
        error: 'invalid_update',
        message: 'Provide name or rules to update the privilege pack.',
      });
    }

    const pack = await prisma.privilegePack.update({
      where: { id: req.params.packId },
      data: {
        ...(name ? { name } : {}),
        ...(rules ? { rules } : {}),
      },
    });

    return res.json(pack);
  } catch (error) {
    console.error('[privileges] pack update failed', error);
    return res.status(500).json({ error: 'privilege_pack_update_failed' });
  }
});

router.post('/privileges/packs/:packId/simulate', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.body?.clinicianId;
    if (!clinicianId || typeof clinicianId !== 'string') {
      return res.status(400).json({ error: 'clinician_id_required' });
    }

    const [pack, graph] = await Promise.all([
      prisma.privilegePack.findUnique({ where: { id: req.params.packId } }),
      buildCredentialGraph(clinicianId),
    ]);

    if (!pack) {
      return res.status(404).json({ error: 'privilege_pack_not_found' });
    }
    if (!graph) {
      return res.status(404).json({ error: 'clinician_not_found' });
    }

    const evaluation = evaluator.evaluate(graph, pack.rules as any);
    return res.json({
      pack,
      clinicianId,
      evaluation,
    });
  } catch (error) {
    console.error('[privileges] simulation failed', error);
    return res.status(500).json({ error: 'privilege_simulation_failed' });
  }
});

router.post('/privileges/packs/:packId/export', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.body?.clinicianId;
    if (!clinicianId || typeof clinicianId !== 'string') {
      return res.status(400).json({ error: 'clinician_id_required' });
    }

    const [pack, graph] = await Promise.all([
      prisma.privilegePack.findUnique({ where: { id: req.params.packId } }),
      buildCredentialGraph(clinicianId),
    ]);

    if (!pack) {
      return res.status(404).json({ error: 'privilege_pack_not_found' });
    }
    if (!graph) {
      return res.status(404).json({ error: 'clinician_not_found' });
    }

    const evaluation = evaluator.evaluate(graph, pack.rules as any);
    const preflight = await runCompliancePreflightScan({
      clinicianId,
      packId: pack.id,
      prisma,
    });

    await recordOnboardingCheckpoint({
      clinicianId,
      step: 'compliance_preflight',
      status:
        preflight.overall === 'block'
          ? 'blocked'
          : preflight.overall === 'warn'
            ? 'pending_review'
            : 'complete',
      blockerCode: selectPrimaryBlocker(preflight),
      metadata: preflight,
      prisma,
    });

    if (preflight.overall === 'block') {
      return res.status(409).json({
        error: 'compliance_preflight_blocked',
        message: 'Compliance preflight blocked packet export.',
        preflight,
      });
    }

    const packet = await generatePrivilegePacket({
      clinicianId,
      packId: pack.id,
      evaluation,
      includePdf: true,
    });

    return res.json({
      packet,
      preflight,
      downloadHint: 'Base64 encoded PDF bundle attached.',
    });
  } catch (error) {
    console.error('[privileges] packet generation failed', error);
    return res.status(500).json({ error: 'privilege_packet_failed' });
  }
});

export default router;

function selectPrimaryBlocker(preflight: Awaited<ReturnType<typeof runCompliancePreflightScan>>) {
  const blocker =
    preflight.findings.find((finding) => finding.severity === 'block') ??
    preflight.findings.find((finding) => finding.severity === 'warn');
  return blocker?.id ?? null;
}

