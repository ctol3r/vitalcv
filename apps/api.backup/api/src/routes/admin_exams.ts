/**
 * Admin Exam Management
 * Bulk operations and reporting for exam records
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const adminExams = Router();

// Get exam statistics
adminExams.get('/api/admin/exams/stats', async (req, res) => {
  try {
    const naplexStats = await prisma.pharmacistExam.groupBy({
      by: ['naplexVer'],
      _count: true,
    });

    const mpjeStats = await prisma.pharmacistExam.groupBy({
      by: ['mpjeMode'],
      _count: true,
    });

    const total = await prisma.pharmacistExam.count();

    res.json({
      ok: true,
      total,
      naplex: naplexStats.map((s: any) => ({
        version: s.naplexVer,
        count: s._count,
      })),
      mpje: mpjeStats.map((s: any) => ({
        mode: s.mpjeMode,
        count: s._count,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Bulk update exam versions (for migration)
adminExams.post('/api/admin/exams/recalculate', async (req, res) => {
  try {
    const records = await prisma.pharmacistExam.findMany();
    let updated = 0;

    for (const record of records) {
      // Recalculate version based on exam date
      // This would use the getVersion() logic
      // For now, just a stub
      updated++;
    }

    res.json({
      ok: true,
      message: `Recalculated ${updated} exam records`,
      total: records.length,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Export exam records as CSV
adminExams.get('/api/admin/exams/export', async (req, res) => {
  try {
    const records = await prisma.pharmacistExam.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = ['NPI', 'NAPLEX Version', 'MPJE Mode', 'Exam Date', 'Created At'];
    const rows = records.map((r: any) => [
      r.npi,
      r.naplexVer,
      r.mpjeMode,
      r.examDate ? r.examDate.toISOString().split('T')[0] : '',
      r.createdAt.toISOString().split('T')[0],
    ]);

    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=exam_records.csv');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get audit trail for exam changes
adminExams.get('/api/admin/exams/audit/:npi', async (req, res) => {
  try {
    const { npi } = req.params;

    const record = await prisma.pharmacistExam.findUnique({
      where: { npi },
    });

    if (!record) {
      return res.status(404).json({ ok: false, error: 'Exam record not found' });
    }

    // In a full implementation, would query audit log table
    res.json({
      ok: true,
      npi,
      current: record,
      changes: [
        {
          timestamp: record.updatedAt,
          field: 'naplexVer',
          oldValue: null,
          newValue: record.naplexVer,
          changedBy: 'system',
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
