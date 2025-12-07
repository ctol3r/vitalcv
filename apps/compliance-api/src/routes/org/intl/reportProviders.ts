/**
 * B139A-REPORT-013: International Coverage Report
 *
 * Reports counts of providers by region/country and compact participation.
 * Supports CSV export.
 */

import { Request, Response } from 'express';
import { Region } from '../../../../../../../services/org/models/TenantRegion';

/**
 * Provider count by region
 */
export interface ProviderCountByRegion {
  region: Region;
  country: string;
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  compactParticipation: {
    imlc: number;
    psypact: number;
    counselingCompact: number;
    nursingCompact: number;
  };
}

/**
 * Report filters
 */
export interface ReportFilters {
  tenantId: string;
  regions?: Region[];
  countries?: string[];
  includeInactive?: boolean;
}

/**
 * Generate provider coverage report
 */
export async function generateProviderCoverageReport(
  filters: ReportFilters
): Promise<ProviderCountByRegion[]> {
  // Placeholder: In production, query database
  console.log('Generating provider coverage report:', filters);

  // Sample data
  const reports: ProviderCountByRegion[] = [
    {
      region: Region.US,
      country: 'United States',
      totalProviders: 1250,
      activeProviders: 1180,
      inactiveProviders: 70,
      compactParticipation: {
        imlc: 450,
        psypact: 120,
        counselingCompact: 80,
        nursingCompact: 200,
      },
    },
    {
      region: Region.EU,
      country: 'Germany',
      totalProviders: 320,
      activeProviders: 305,
      inactiveProviders: 15,
      compactParticipation: {
        imlc: 0,
        psypact: 0,
        counselingCompact: 0,
        nursingCompact: 0,
      },
    },
    {
      region: Region.EU,
      country: 'France',
      totalProviders: 180,
      activeProviders: 175,
      inactiveProviders: 5,
      compactParticipation: {
        imlc: 0,
        psypact: 0,
        counselingCompact: 0,
        nursingCompact: 0,
      },
    },
    {
      region: Region.AU,
      country: 'Australia',
      totalProviders: 420,
      activeProviders: 400,
      inactiveProviders: 20,
      compactParticipation: {
        imlc: 0,
        psypact: 0,
        counselingCompact: 0,
        nursingCompact: 0,
      },
    },
  ];

  // Apply filters
  let filtered = reports;

  if (filters.regions && filters.regions.length > 0) {
    filtered = filtered.filter(r => filters.regions!.includes(r.region));
  }

  if (filters.countries && filters.countries.length > 0) {
    filtered = filtered.filter(r => filters.countries!.includes(r.country));
  }

  return filtered;
}

/**
 * Convert report to CSV
 */
export function convertToCSV(reports: ProviderCountByRegion[]): string {
  const headers = [
    'Region',
    'Country',
    'Total Providers',
    'Active Providers',
    'Inactive Providers',
    'IMLC Participants',
    'PsyPact Participants',
    'Counseling Compact Participants',
    'Nursing Compact Participants',
  ];

  const rows = reports.map(r => [
    r.region,
    r.country,
    r.totalProviders,
    r.activeProviders,
    r.inactiveProviders,
    r.compactParticipation.imlc,
    r.compactParticipation.psypact,
    r.compactParticipation.counselingCompact,
    r.compactParticipation.nursingCompact,
  ]);

  const csvLines = [headers, ...rows].map(row => row.join(','));

  return csvLines.join('\n');
}

/**
 * Express route handler
 */
export async function handleProviderCoverageReport(req: Request, res: Response): Promise<void> {
  try {
    const tenantMetadata = (req as any).tenantMetadata;
    if (!tenantMetadata) {
      res.status(400).json({ error: 'Tenant metadata not found' });
      return;
    }

    const filters: ReportFilters = {
      tenantId: tenantMetadata.tenantId,
      regions: req.query.regions ? (req.query.regions as string).split(',') as Region[] : undefined,
      countries: req.query.countries ? (req.query.countries as string).split(',') : undefined,
      includeInactive: req.query.includeInactive === 'true',
    };

    const reports = await generateProviderCoverageReport(filters);

    // Check if CSV export requested
    if (req.query.format === 'csv') {
      const csv = convertToCSV(reports);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=provider-coverage-report.csv');
      res.send(csv);
      return;
    }

    // JSON response
    res.json({
      reports,
      summary: {
        totalRegions: new Set(reports.map(r => r.region)).size,
        totalCountries: reports.length,
        totalProviders: reports.reduce((sum, r) => sum + r.totalProviders, 0),
        activeProviders: reports.reduce((sum, r) => sum + r.activeProviders, 0),
        totalCompactParticipants: reports.reduce(
          (sum, r) =>
            sum +
            r.compactParticipation.imlc +
            r.compactParticipation.psypact +
            r.compactParticipation.counselingCompact +
            r.compactParticipation.nursingCompact,
          0
        ),
      },
    });
  } catch (error) {
    console.error('Provider coverage report error:', error);
    res.status(500).json({
      error: 'Report generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

