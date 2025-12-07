import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateTempPriv, MAX_TEMP_DAYS } from '../policy/JCAHO';

const prisma = new PrismaClient();
export const privilegesRouter = Router();

// Request temporary privileges
privilegesRouter.post('/api/privileges/temp', async (req, res) => {
  try {
    const { npi, facility, startDate, endDate, daysGranted } = req.body;

    // Validate against JCAHO rules
    if (!validateTempPriv(daysGranted)) {
      return res.status(400).json({
        ok: false,
        error: `Temporary privileges cannot exceed ${MAX_TEMP_DAYS} consecutive days (JCAHO MS.06.01.13)`,
        standard: 'JCAHO MS.06.01.13',
      });
    }

    const record = await prisma.temporaryPrivilege.create({
      data: {
        npi,
        facility,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysGranted,
        status: 'active',
      },
    });

    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get temp privileges for NPI
privilegesRouter.get('/api/privileges/temp/:npi', async (req, res) => {
  try {
    const { npi } = req.params;
    const privileges = await prisma.temporaryPrivilege.findMany({
      where: { npi },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, privileges });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Extend temp privilege (validates against JCAHO limit)
privilegesRouter.post('/api/privileges/temp/:id/extend', async (req, res) => {
  try {
    const { id } = req.params;
    const { additionalDays } = req.body;

    const existing = await prisma.temporaryPrivilege.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Privilege not found' });
    }

    const newTotal = existing.daysGranted + additionalDays;

    if (!validateTempPriv(newTotal)) {
      // Record violation
      await prisma.temporaryPrivilege.update({
        where: { id },
        data: {
          status: 'violated',
          violationNote: `Extension denied: would exceed ${MAX_TEMP_DAYS}-day limit (JCAHO MS.06.01.13)`,
        },
      });

      return res.status(400).json({
        ok: false,
        error: `Cannot extend: would exceed ${MAX_TEMP_DAYS}-day limit`,
        standard: 'JCAHO MS.06.01.13',
      });
    }

    const newEnd = new Date(existing.endDate);
    newEnd.setDate(newEnd.getDate() + additionalDays);

    const updated = await prisma.temporaryPrivilege.update({
      where: { id },
      data: {
        daysGranted: newTotal,
        endDate: newEnd,
      },
    });

    res.json({ ok: true, record: updated });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

