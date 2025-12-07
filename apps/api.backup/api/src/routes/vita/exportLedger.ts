/**
 * S72-STRETCH-E-008: VITA Ledger Export for Finance (CSV)
 *
 * Exports ledger of VITA transactions (orgId, amount, type, txId, timestamp)
 * CSV downloadable; sums validated in tests
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { featureFlagGuard, checkFeatureFlag, getFeatureFlagService } from '../../../../services/flags/featureFlags';

const router = Router();
const prisma = new PrismaClient();

// Query schema for filtering
const ExportQuerySchema = z.object({
  orgId: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
});

/**
 * Convert VITA ledger entries to CSV format
 */
function generateCSV(entries: any[]): string {
  const headers = ['id', 'orgId', 'amount', 'type', 'txId', 'reference', 'createdAt'];
  const rows = entries.map((entry) => [
    entry.id,
    entry.orgId || '',
    entry.amount,
    entry.type,
    entry.txId || '',
    entry.reference || '',
    entry.createdAt.toISOString(),
  ]);

  const csvRows = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ];

  return csvRows.join('\n');
}

/**
 * B149B-FF-014: Guard VITA features with `billing.vita.enabled`
 * GET /vita/exportLedger
 * Export VITA ledger as CSV
 * If flag disabled, returns 501 Not Implemented with helpful message
 */
router.get(
  '/exportLedger',
  featureFlagGuard('billing.vita.enabled', {
    statusCode: 501,
    errorCode: 'NOT_IMPLEMENTED',
    errorMessage: 'VITA billing features are not currently implemented. Please contact support for more information.',
  }),
  async (req: Request, res: Response) => {
  try {
    const query = ExportQuerySchema.parse(req.query);

    // Build where clause
    const where: any = {};
    if (query.orgId) {
      where.orgId = query.orgId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Fetch ledger entries
    const entries = await prisma.vitaLedger.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Generate CSV
    const csv = generateCSV(entries);

    // Calculate sums for validation
    const totalDebits = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const totalCredits = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const netAmount = entries.reduce((sum, e) => sum + e.amount, 0);

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vita-ledger-${Date.now()}.csv"`);
    res.setHeader('X-Total-Entries', entries.length.toString());
    res.setHeader('X-Total-Debits', totalDebits.toString());
    res.setHeader('X-Total-Credits', totalCredits.toString());
    res.setHeader('X-Net-Amount', netAmount.toString());

    return res.send(csv);
  } catch (error: any) {
    console.error('[vita/exportLedger] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to export VITA ledger',
    });
  }
  }
);

export default router;

