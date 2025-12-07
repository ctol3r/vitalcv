import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { runQAChecks, generateDiffReport, ProgramRecord } from '../services/residencyETL';

const prisma = new PrismaClient();
export const etlRouter = Router();

// Run QA checks on program data
etlRouter.post('/api/etl/qa', async (req, res) => {
  try {
    const { programs } = req.body;
    const report = await runQAChecks(programs);

    if (!report.passed) {
      return res.status(400).json({
        ok: false,
        message: `QA check failed: ${report.validPercent.toFixed(2)}% valid (threshold: 98%)`,
        report,
      });
    }

    res.json({ ok: true, report });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Generate diff report
etlRouter.post('/api/etl/diff', async (req, res) => {
  try {
    const { before, after } = req.body;
    const diff = await generateDiffReport(before, after);

    res.json({
      ok: true,
      diff,
      summary: {
        added: diff.added.length,
        changed: diff.changed.length,
        removed: diff.removed.length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get programs with filters
etlRouter.get('/api/etl/programs', async (req, res) => {
  try {
    const { country, accreditor, limit = 100 } = req.query;

    const where: any = {};
    if (country) where.country = country;
    if (accreditor) where.accreditor = accreditor;

    const programs = await prisma.program.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, programs, count: programs.length });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

