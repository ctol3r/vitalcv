import { Router, type Request, type Response } from 'express';
import { PrismaClient, type ClinicianReadinessScore } from '@prisma/client';
import { listRecentContacts } from '../../services/recruiter/contact';

const prisma = new PrismaClient();
const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [readiness, contacts, readinessTimeline] = await Promise.all([
      prisma.clinicianReadinessScore.findMany({
        orderBy: { score: 'desc' },
        take: 50,
      }),
      listRecentContacts(25),
      prisma.clinicianReadinessScore.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    ]);

    const contactMap = new Map<string, Date>();
    contacts.forEach((contact) => {
      const existing = contactMap.get(contact.clinicianId);
      if (!existing || existing < contact.contactedAt) {
        contactMap.set(contact.clinicianId, contact.contactedAt);
      }
    });

    const activeLeads = readiness
      .filter((record) => record.score >= 0.72)
      .map((record) => ({
        clinicianId: record.clinicianId,
        readinessScore: record.score,
        lastUpdated: record.updatedAt,
        sanctionsClear: Boolean(
          (record.factors as { sanctionsClear?: boolean } | null)?.sanctionsClear ?? true,
        ),
        lastContactedAt: contactMap.get(record.clinicianId) ?? null,
      }));

    const staleCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const staleContacts = activeLeads.filter((lead) => {
      if (!lead.lastContactedAt) return true;
      return lead.lastContactedAt.getTime() < staleCutoff;
    });

    const readinessChanges = readinessTimeline.map((record) =>
      buildReadinessChange(record),
    );

    const summary = {
      totalTracked: readiness.length,
      activeLeads: activeLeads.length,
      avgReadiness:
        readiness.reduce((sum, record) => sum + record.score, 0) /
        Math.max(1, readiness.length),
      contactCoverage:
        activeLeads.length === 0
          ? 1
          : (activeLeads.length - staleContacts.length) / activeLeads.length,
      readinessImproving: readinessChanges.filter((change) => change.delta > 0).length,
      readinessDeclining: readinessChanges.filter((change) => change.delta < 0).length,
    };

    return res.json({
      summary,
      activeLeads,
      staleContacts,
      recentContacts: contacts,
      readinessChanges,
    });
  } catch (error) {
    console.error('[Recruiter][crm] overview failed', error);
    return res.status(500).json({
      error: 'recruiter_crm_overview_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function buildReadinessChange(record: ClinicianReadinessScore) {
  const factors = (record.factors as Record<string, any>) ?? {};
  const previous =
    typeof factors.previousScore === 'number'
      ? factors.previousScore
      : typeof factors.baseline === 'number'
        ? factors.baseline
        : clamp(
            record.score -
              (Array.isArray(factors.trendline)
                ? Number(factors.trendline[0])
                : 0.05),
          );
  const delta = clamp(record.score - previous);

  return {
    clinicianId: record.clinicianId,
    currentScore: record.score,
    previousScore: previous,
    delta,
    updatedAt: record.updatedAt,
    notes: Array.isArray(factors.notes) ? factors.notes : [],
  };
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export default router;










