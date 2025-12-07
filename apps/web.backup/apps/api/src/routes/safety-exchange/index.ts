import { Router } from 'express';
import { z } from 'zod';
import {
  ingestSanctionsV2,
  harmonizeSanctions,
  propagateSanctionsToOrgs,
  buildAdverseActionLineage,
  mapCrossBorderSanctions,
  predictFutureSanctions,
  generateSanctionsAuditPacket,
} from '@/services/safety-exchange';
import { anchorSafetyExchange } from '@/services/safety-exchange/anchor';

const router = Router();

const clinicianIdParam = z.object({
  clinicianId: z.string().min(1),
});

// Ingest sanctions
router.post('/:clinicianId/ingest', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const result = await ingestSanctionsV2(clinicianId);
    res.json(result);
  } catch (error) {
    console.error('[safety-exchange] ingest error', error);
    res.status(500).json({ error: 'Failed to ingest sanctions' });
  }
});

// Get harmonized sanctions
router.get('/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const ingestion = await ingestSanctionsV2(clinicianId);
    const harmonized = harmonizeSanctions(ingestion.events);
    const lineages = buildAdverseActionLineage(harmonized);
    const predictions = predictFutureSanctions(lineages, harmonized);

    res.json({
      clinicianId,
      sanctions: harmonized,
      lineages,
      predictions,
    });
  } catch (error) {
    console.error('[safety-exchange] get error', error);
    res.status(500).json({ error: 'Failed to get safety exchange data' });
  }
});

// Propagate to organizations
router.post('/:clinicianId/propagate', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const ingestion = await ingestSanctionsV2(clinicianId);
    const harmonized = harmonizeSanctions(ingestion.events);
    const targets = await propagateSanctionsToOrgs(clinicianId, harmonized);

    res.json({ targets, propagatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[safety-exchange] propagate error', error);
    res.status(500).json({ error: 'Failed to propagate sanctions' });
  }
});

// Generate audit packet
router.post('/:clinicianId/audit-pack', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const ingestion = await ingestSanctionsV2(clinicianId);
    const harmonized = harmonizeSanctions(ingestion.events);
    const lineages = buildAdverseActionLineage(harmonized);
    const crossBorder = mapCrossBorderSanctions(harmonized);
    const predictions = predictFutureSanctions(lineages, harmonized);

    const packet = generateSanctionsAuditPacket(
      clinicianId,
      harmonized,
      lineages,
      crossBorder,
      predictions,
    );

    // Anchor to blockchain
    anchorSafetyExchange(packet);

    res.json(packet);
  } catch (error) {
    console.error('[safety-exchange] audit-pack error', error);
    res.status(500).json({ error: 'Failed to generate audit packet' });
  }
});

export default router;

