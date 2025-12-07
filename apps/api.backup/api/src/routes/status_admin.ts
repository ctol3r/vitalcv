/**
 * Status Admin API - Round 12
 * Manage credential status index mapping and revocation
 * Round 20: Added Zod validation
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { markRevoked } from '../services/revocation/statusListManager';
import { validate } from '../middleware/validate';

const router = Router();
const prisma = new PrismaClient();

// Round 20: Zod schemas for input validation
const AssignSchema = z.object({
  cred_id: z.string().min(1),
  index: z.number().int().nonnegative()
});

const RevokeSchema = z.object({
  cred_id: z.string().min(1),
  reason: z.string().optional(),
  subject_did: z.string().optional(),
  cred_type: z.string().optional()
});

/**
 * POST /api/status-admin/assign
 * Assign a status list index to a credential ID
 */
router.post('/assign', validate(AssignSchema), async (req: Request, res: Response) => {
  try {
    const { cred_id, index } = req.body;

    // Insert into VcStatusIndex table (using raw SQL since table isn't in Prisma schema)
    await prisma.$executeRaw`
      INSERT INTO "VcStatusIndex" (cred_id, sl_index)
      VALUES (${cred_id}, ${index})
      ON CONFLICT (cred_id) DO NOTHING
    `;

    res.json({ ok: true, cred_id, index });
  } catch (error: any) {
    console.error('Error assigning status index:', error);
    res.status(500).json({ error: 'Internal error', message: error.message });
  }
});

/**
 * POST /api/status-admin/revoke
 * Revoke a credential by flipping its status bit
 */
router.post('/revoke', validate(RevokeSchema), async (req: Request, res: Response) => {
  try {
    const { cred_id, reason, subject_did, cred_type } = req.body;

    // Get the status index for this credential
    const result = await prisma.$queryRaw<Array<{ sl_index: number }>>`
      SELECT sl_index FROM "VcStatusIndex" WHERE cred_id = ${cred_id}
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'no_index', message: 'Credential not assigned a status index' });
    }

    const statusIndex = result[0].sl_index;

    // Flip the bit in the status list
    markRevoked(statusIndex);

    // Record the revocation event
    await prisma.$executeRaw`
      INSERT INTO "VcRevocation" (subject_did, cred_type, cred_id, status, reason, revoked_at)
      VALUES (
        ${subject_did || 'did:unknown'},
        ${cred_type || 'MedicalLicense'},
        ${cred_id},
        'revoked',
        ${reason || null},
        now()
      )
    `;

    res.json({ ok: true, cred_id, index: statusIndex, revoked_at: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error revoking credential:', error);
    res.status(500).json({ error: 'Internal error', message: error.message });
  }
});

/**
 * GET /api/status-admin/stats
 * Get revocation statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalRevoked = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "VcRevocation"
    `;

    const totalAssigned = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "VcStatusIndex"
    `;

    res.json({
      total_revoked: Number(totalRevoked[0]?.count || 0),
      total_assigned: Number(totalAssigned[0]?.count || 0),
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal error', message: error.message });
  }
});

export const statusAdminRouter = router;

