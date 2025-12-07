import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getVersion } from '../services/exams';

const prisma = new PrismaClient();
export const pharmacistRouter = Router();

// Create or update pharmacist exam record
pharmacistRouter.post('/api/pharmacist/exam/:npi', async (req, res) => {
  try {
    const { npi } = req.params;
    const { examDate, state, evidenceUrls } = req.body;

    const dateStr = examDate || new Date().toISOString().split('T')[0];
    const naplexVer = await getVersion('naplex', dateStr);
    const mpjeMode = await getVersion('mpje', dateStr, state);

    const record = await prisma.pharmacistExam.upsert({
      where: { npi },
      create: {
        npi,
        naplexVer,
        mpjeMode,
        examDate: examDate ? new Date(examDate) : null,
        evidenceUrls: evidenceUrls || {},
      },
      update: {
        naplexVer,
        mpjeMode,
        examDate: examDate ? new Date(examDate) : undefined,
        evidenceUrls: evidenceUrls || undefined,
      },
    });

    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get pharmacist exam record
pharmacistRouter.get('/api/pharmacist/exam/:npi', async (req, res) => {
  try {
    const { npi } = req.params;
    const record = await prisma.pharmacistExam.findUnique({
      where: { npi },
    });

    if (!record) {
      return res.status(404).json({ ok: false, error: 'No exam record found' });
    }

    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

