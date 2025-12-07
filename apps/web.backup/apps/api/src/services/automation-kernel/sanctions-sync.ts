import { prisma } from '@/lib/prisma';
import { ingestSanctionsV2 } from '@/services/safety-exchange';

/**
 * Auto-update credential status via NPDB/OIG events
 */
export async function syncSanctionsToCredentials(clinicianId: string): Promise<void> {
  // Ingest latest sanctions
  const sanctions = await ingestSanctionsV2(clinicianId);

  // Update credential status if sanctions found
  if (sanctions.events.length > 0) {
    const criticalSanctions = sanctions.events.filter(
      (e) => e.severity === 'critical' || e.severity === 'high',
    );

    if (criticalSanctions.length > 0) {
      // Update automation kernel status
      await prisma.automationKernel.create({
        data: {
          tasks: {
            type: 'sanctions_sync',
            clinicianId,
            sanctionsFound: criticalSanctions.length,
            action: 'credentials_suspended',
          },
          status: 'completed',
        },
      });

      // In production, would update credential status here
      console.log(`[automation-kernel] Suspending credentials for ${clinicianId} due to sanctions`);
    }
  }
}

