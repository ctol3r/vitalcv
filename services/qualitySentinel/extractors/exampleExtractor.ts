/**
 * Example micro-signal extractor
 *
 * This is a template showing how to create extractors that return
 * MicroSignalDataPoint[] for the sentinel model
 */

import type { MicroSignalDataPoint } from '../model/sentinelModel.js';
import type { MicroSignalExtractor } from '../../../jobs/qualitySentinel/sentinelOrchestrator.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Example extractor that extracts OPPE score trends as micro-signals
 */
export const oppeMicroDriftExtractor: MicroSignalExtractor = {
  id: 'oppeMicroDrift',
  name: 'OPPE Micro-Drift Extractor',

  async extract(clinicianId: string, lookbackDays: number): Promise<MicroSignalDataPoint[]> {
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Fetch OPPE data from database
    // This is a simplified example - adjust based on your actual schema
    const oppeData = await prisma.fppeOppe.findMany({
      where: {
        // Adjust based on your actual schema relationships
        // This is a placeholder
      },
      orderBy: {
        // Order by review date
      },
    });

    // Convert to MicroSignalDataPoint format
    const dataPoints: MicroSignalDataPoint[] = oppeData.map((record) => {
      // Extract a normalized score (0-1) from the OPPE record
      // This is example logic - adjust based on your actual data structure
      const score = 0.8; // Placeholder - calculate from actual OPPE metrics

      return {
        timestamp: new Date(), // Use actual review date from record
        value: score,
        metadata: {
          recordId: record.id,
          // Add other relevant metadata
        },
      };
    });

    return dataPoints;
  },
};

