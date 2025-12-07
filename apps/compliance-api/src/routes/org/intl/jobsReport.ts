/**
 * B139A-REPORT-014: International Jobs Report
 *
 * Summarizes open roles per country/region and license requirements.
 * Supports CSV export.
 */

import { Request, Response } from 'express';
import { Region } from '../../../../../../../services/org/models/TenantRegion';

/**
 * Job summary by region
 */
export interface JobSummaryByRegion {
  region: Region;
  country: string;
  openRoles: number;
  rolesBySpecialty: Record<string, number>;
  licenseRequirements: {
    requiresCompact: number;
    requiresStateLicense: number;
    requiresInternationalLicense: number;
    telehealthOnly: number;
  };
  averageSalary?: number;
  currency?: string;
}

/**
 * Report filters
 */
export interface JobReportFilters {
  tenantId: string;
  regions?: Region[];
  countries?: string[];
  specialties?: string[];
  includeInactive?: boolean;
}

/**
 * Generate international jobs report
 */
export async function generateInternationalJobsReport(
  filters: JobReportFilters
): Promise<JobSummaryByRegion[]> {
  // Placeholder: In production, query database
  console.log('Generating international jobs report:', filters);

  // Sample data
  const reports: JobSummaryByRegion[] = [
    {
      region: Region.US,
      country: 'United States',
      openRoles: 245,
      rolesBySpecialty: {
        'Family Medicine': 80,
        'Emergency Medicine': 45,
        'Psychiatry': 35,
        'Cardiology': 25,
        'Nursing': 60,
      },
      licenseRequirements: {
        requiresCompact: 120,
        requiresStateLicense: 245,
        requiresInternationalLicense: 0,
        telehealthOnly: 45,
      },
      averageSalary: 285000,
      currency: 'USD',
    },
    {
      region: Region.EU,
      country: 'Germany',
      openRoles: 68,
      rolesBySpecialty: {
        'General Practice': 25,
        'Internal Medicine': 20,
        'Surgery': 15,
        'Nursing': 8,
      },
      licenseRequirements: {
        requiresCompact: 0,
        requiresStateLicense: 0,
        requiresInternationalLicense: 68,
        telehealthOnly: 12,
      },
      averageSalary: 95000,
      currency: 'EUR',
    },
    {
      region: Region.EU,
      country: 'France',
      openRoles: 42,
      rolesBySpecialty: {
        'Pediatrics': 15,
        'Neurology': 12,
        'Nursing': 15,
      },
      licenseRequirements: {
        requiresCompact: 0,
        requiresStateLicense: 0,
        requiresInternationalLicense: 42,
        telehealthOnly: 8,
      },
      averageSalary: 78000,
      currency: 'EUR',
    },
    {
      region: Region.AU,
      country: 'Australia',
      openRoles: 89,
      rolesBySpecialty: {
        'General Practice': 35,
        'Emergency Medicine': 20,
        'Psychiatry': 18,
        'Nursing': 16,
      },
      licenseRequirements: {
        requiresCompact: 0,
        requiresStateLicense: 0,
        requiresInternationalLicense: 89,
        telehealthOnly: 22,
      },
      averageSalary: 180000,
      currency: 'AUD',
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

  if (filters.specialties && filters.specialties.length > 0) {
    filtered = filtered.map(r => ({
      ...r,
      rolesBySpecialty: Object.fromEntries(
        Object.entries(r.rolesBySpecialty).filter(([specialty]) =>
          filters.specialties!.includes(specialty)
        )
      ),
      openRoles: Object.entries(r.rolesBySpecialty)
        .filter(([specialty]) => filters.specialties!.includes(specialty))
        .reduce((sum, [, count]) => sum + count, 0),
    }));
  }

  return filtered;
}

/**
 * Convert report to CSV
 */
export function convertJobsReportToCSV(reports: JobSummaryByRegion[]): string {
  const headers = [
    'Region',
    'Country',
    'Open Roles',
    'Top Specialty',
    'Specialty Count',
    'Requires Compact',
    'Requires State License',
    'Requires International License',
    'Telehealth Only',
    'Average Salary',
    'Currency',
  ];

  const rows = reports.map(r => {
    const topSpecialty = Object.entries(r.rolesBySpecialty).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    return [
      r.region,
      r.country,
      r.openRoles,
      topSpecialty[0],
      topSpecialty[1],
      r.licenseRequirements.requiresCompact,
      r.licenseRequirements.requiresStateLicense,
      r.licenseRequirements.requiresInternationalLicense,
      r.licenseRequirements.telehealthOnly,
      r.averageSalary || 'N/A',
      r.currency || '',
    ];
  });

  const csvLines = [headers, ...rows].map(row => row.join(','));

  return csvLines.join('\n');
}

/**
 * Express route handler
 */
export async function handleInternationalJobsReport(req: Request, res: Response): Promise<void> {
  try {
    const tenantMetadata = (req as any).tenantMetadata;
    if (!tenantMetadata) {
      res.status(400).json({ error: 'Tenant metadata not found' });
      return;
    }

    const filters: JobReportFilters = {
      tenantId: tenantMetadata.tenantId,
      regions: req.query.regions ? (req.query.regions as string).split(',') as Region[] : undefined,
      countries: req.query.countries ? (req.query.countries as string).split(',') : undefined,
      specialties: req.query.specialties ? (req.query.specialties as string).split(',') : undefined,
      includeInactive: req.query.includeInactive === 'true',
    };

    const reports = await generateInternationalJobsReport(filters);

    // Check if CSV export requested
    if (req.query.format === 'csv') {
      const csv = convertJobsReportToCSV(reports);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=international-jobs-report.csv');
      res.send(csv);
      return;
    }

    // JSON response
    res.json({
      reports,
      summary: {
        totalRegions: new Set(reports.map(r => r.region)).size,
        totalCountries: reports.length,
        totalOpenRoles: reports.reduce((sum, r) => sum + r.openRoles, 0),
        totalCompactRoles: reports.reduce((sum, r) => sum + r.licenseRequirements.requiresCompact, 0),
        totalTelehealthRoles: reports.reduce((sum, r) => sum + r.licenseRequirements.telehealthOnly, 0),
      },
    });
  } catch (error) {
    console.error('International jobs report error:', error);
    res.status(500).json({
      error: 'Report generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

