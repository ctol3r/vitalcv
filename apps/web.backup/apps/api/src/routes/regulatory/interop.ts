import { Router, type Request, type Response } from 'express';
import {
  getOrCreateRegulatoryMapping,
  detectRegulatoryGaps,
  generateRegulatoryCompliancePacket,
} from '../../services/regulatory/interop';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const region = (req.query.region as string) ?? 'US';
    const mapping = await getOrCreateRegulatoryMapping(clinicianId, region);
    return res.json(mapping);
  } catch (error) {
    console.error('[regulatory:interop] failed', error);
    return res.status(500).json({
      error: 'regulatory_mapping_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/gaps/:standard', async (req: Request, res: Response) => {
  try {
    const { clinicianId, standard } = req.params;
    const gaps = await detectRegulatoryGaps(
      clinicianId,
      standard as 'NCQA' | 'JC' | 'DEA' | 'ECFMG'
    );
    return res.json({ gaps });
  } catch (error) {
    console.error('[regulatory:gaps] failed', error);
    return res.status(500).json({
      error: 'regulatory_gaps_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/export/:standard', async (req: Request, res: Response) => {
  try {
    const { clinicianId, standard } = req.params;
    const packet = await generateRegulatoryCompliancePacket(
      clinicianId,
      standard as 'NCQA' | 'JC' | 'DEA' | 'ECFMG'
    );

    // Anchor the mapping
    const mappingHash = createHash('sha256')
      .update(JSON.stringify(packet))
      .digest('hex');

    anchorEvent('regulatoryInteropAnchored', {
      clinicianId,
      standard,
      mappingHash,
      complianceStatus: packet.compliance.status,
    });

    return res.json(packet);
  } catch (error) {
    console.error('[regulatory:export] failed', error);
    return res.status(500).json({
      error: 'regulatory_export_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:clinicianId/switch-region', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { region } = req.body;
    const mapping = await getOrCreateRegulatoryMapping(clinicianId, region);
    return res.json({ region, mapping });
  } catch (error) {
    console.error('[regulatory:switch] failed', error);
    return res.status(500).json({
      error: 'region_switch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

