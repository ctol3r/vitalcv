import { prisma } from '@/lib/prisma';

export interface RenewalForecast {
  credentialId: string;
  credentialType: string;
  currentExpiration: string;
  predictedRenewalDate: string;
  tasksRequired: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  daysUntilExpiration: number;
}

/**
 * Predict upcoming renewal and tasks required
 */
export async function forecastRenewals(clinicianId: string): Promise<RenewalForecast[]> {
  const forecasts: RenewalForecast[] = [];

  // Query licenses and credentials (mock - would query actual credential data)
  // For now, use hiring events to infer credentials

  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });

  // Generate forecasts based on typical renewal cycles
  const now = new Date();
  const typicalRenewalCycle = 2; // years

  for (const event of hiringEvents) {
    const eventDate = new Date(event.createdAt);
    const renewalDate = new Date(eventDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + typicalRenewalCycle);

    const daysUntil = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil > 0 && daysUntil < 365) {
      forecasts.push({
        credentialId: event.id,
        credentialType: 'employment_credential',
        currentExpiration: renewalDate.toISOString(),
        predictedRenewalDate: renewalDate.toISOString(),
        tasksRequired: [
          'Complete renewal application',
          'Submit required documentation',
          'Pay renewal fee',
          'Update contact information',
        ],
        urgency: daysUntil < 90 ? 'critical' : daysUntil < 180 ? 'high' : daysUntil < 270 ? 'medium' : 'low',
        daysUntilExpiration: daysUntil,
      });
    }
  }

  return forecasts.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
}

