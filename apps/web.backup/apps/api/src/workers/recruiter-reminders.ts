import { PrismaClient } from '@prisma/client';
import { createRecruiterNote } from '../services/recruiter/notes';
import { recordRecruiterContact } from '../services/recruiter/contact';

const prisma = new PrismaClient();
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface ReminderOptions {
  daysWithoutContact?: number;
  limit?: number;
  recruiterId?: string;
}

export interface ReminderResult {
  reminded: number;
  clinicianIds: string[];
  runAt: string;
}

export async function runRecruiterReminderSweep(
  options: ReminderOptions = {},
): Promise<ReminderResult> {
  const daysWithoutContact = options.daysWithoutContact ?? 7;
  const limit = options.limit ?? 25;
  const recruiterId = options.recruiterId ?? 'auto-reminder';
  const cutoff = Date.now() - daysWithoutContact * 24 * 60 * 60 * 1000;

  const candidates = await prisma.clinicianReadinessScore.findMany({
    orderBy: { score: 'desc' },
    take: limit * 2,
  });
  const clinicianIds = candidates.map((candidate) => candidate.clinicianId);

  const contacts = await prisma.recruiterContactEvent.findMany({
    where: { clinicianId: { in: clinicianIds } },
    orderBy: { contactedAt: 'desc' },
  });

  const contactMap = new Map<string, Date>();
  contacts.forEach((contact) => {
    if (!contactMap.has(contact.clinicianId)) {
      contactMap.set(contact.clinicianId, contact.contactedAt);
    }
  });

  const stale = clinicianIds.filter((clinicianId) => {
    const lastContact = contactMap.get(clinicianId);
    if (!lastContact) return true;
    return lastContact.getTime() < cutoff;
  });

  const reminded: string[] = [];
  for (const clinicianId of stale.slice(0, limit)) {
    await Promise.all([
      createRecruiterNote({
        clinicianId,
        recruiterId,
        note: `Automated reminder: no contact in ${daysWithoutContact} days.`,
      }).catch((error) => {
        console.warn('[Recruiter][reminder] failed to write note', error);
      }),
      recordRecruiterContact({
        clinicianId,
        recruiterId,
        channel: 'system',
        metadata: { reason: 'automated_reminder' },
        contactedAt: new Date(),
      }).catch((error) => {
        console.warn('[Recruiter][reminder] contact stamp failed', error);
      }),
    ]);
    reminded.push(clinicianId);
  }

  if (reminded.length) {
    console.info('[Recruiter][reminder] notifications dispatched', {
      reminded,
      recruiterId,
      daysWithoutContact,
    });
  }

  return {
    reminded: reminded.length,
    clinicianIds: reminded,
    runAt: new Date().toISOString(),
  };
}

export function scheduleRecruiterReminders(options?: ReminderOptions) {
  runRecruiterReminderSweep(options).catch((error) => {
    console.error('[Recruiter][reminder] initial sweep failed', error);
  });

  setInterval(() => {
    runRecruiterReminderSweep(options).catch((error) => {
      console.error('[Recruiter][reminder] scheduled sweep failed', error);
    });
  }, REMINDER_INTERVAL_MS);
}

if (require.main === module) {
  console.log('[Recruiter][reminder] worker starting');
  scheduleRecruiterReminders();
}

