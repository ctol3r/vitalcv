/**
 * B145C-EXEC-005: Exec-level quarterly analytics export
 *
 * Generates a ZIP bundle containing:
 * - ROI metrics (CSV + JSON)
 * - Compliance health scores (CSV + JSON)
 * - Supply/demand heatmap data (CSV + JSON)
 * - Job funnel metrics (CSV + JSON)
 * - Organization growth trends (CSV + JSON)
 * - Executive summary PDF (optional)
 *
 * Tested with synthetic data for validation.
 */

import express, { Request, Response } from 'express';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import archiver from 'archiver';

const router = express.Router();

interface ROIMetric {
  period_month: string;
  org_id: string;
  total_credentials_processed: number;
  completed_credentials: number;
  avg_days_platform: number;
  avg_days_traditional: number;
  days_saved_per_credential: number;
  total_days_saved: number;
  admin_cost_savings_usd: number;
  revenue_acceleration_usd: number;
  total_roi_usd: number;
  time_reduction_pct: number;
  roi_per_credential_usd: number;
  performance_tier: string;
}

interface ComplianceHealthMetric {
  org_id: string;
  total_clinicians: number;
  clinicians_with_npi: number;
  ncqa_score: number;
  psv_score: number;
  privileges_score: number;
  payer_score: number;
  total_score: number;
  health_grade: string;
  computed_at: string;
}

interface SupplyDemandMetric {
  state: string;
  specialty_code: string;
  lat: number;
  lon: number;
  jobs_open: number;
  clinicians_available: number;
  supply_demand_ratio: number;
  estimated_fillable_positions: number;
  market_status: string;
  opportunity_score: number;
}

interface JobFunnelMetric {
  period_month: string;
  total_applications: number;
  applications_pending: number;
  applications_reviewed: number;
  applications_accepted: number;
  applications_rejected: number;
  avg_match_score: number;
  median_match_score: number;
  conversion_rate_pct: number;
}

interface OrgGrowthMetric {
  period_month: string;
  new_orgs: number;
  active_orgs: number;
  new_clinicians: number;
  active_clinicians: number;
  total_credentials_issued: number;
  growth_rate_pct: number;
}

/**
 * POST /exec/quarterly-export
 * Generate quarterly analytics bundle as ZIP
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, includeOrgDetails } = req.body;

    // Parse date range or use current quarter
    const quarterStart = startDate
      ? new Date(startDate)
      : getQuarterStart(new Date());
    const quarterEnd = endDate
      ? new Date(endDate)
      : getQuarterEnd(new Date());

    console.log(`Generating quarterly export for ${quarterStart.toISOString()} to ${quarterEnd.toISOString()}`);

    // Fetch data from warehouse views
    // In production, these would query the actual PostgreSQL views
    const [
      roiMetrics,
      complianceMetrics,
      supplyDemandMetrics,
      jobFunnelMetrics,
      orgGrowthMetrics,
    ] = await Promise.all([
      fetchROIMetrics(quarterStart, quarterEnd),
      fetchComplianceMetrics(),
      fetchSupplyDemandMetrics(),
      fetchJobFunnelMetrics(quarterStart, quarterEnd),
      fetchOrgGrowthMetrics(quarterStart, quarterEnd),
    ]);

    // Create temporary directory for files
    const exportId = randomUUID();
    const tempDir = join(tmpdir(), `exec-export-${exportId}`);
    const zipPath = join(tmpdir(), `exec-quarterly-export-${exportId}.zip`);

    // Create ZIP archive
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Export ZIP created: ${archive.pointer()} bytes`);
      // Send the ZIP file
      res.download(zipPath, `exec-quarterly-export-${quarterStart.toISOString().slice(0, 10)}.zip`, (err) => {
        if (err) {
          console.error('Error sending ZIP:', err);
        }
        // Cleanup temp files
        // In production, use a proper cleanup mechanism
        require('fs').unlinkSync(zipPath);
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Add ROI metrics (CSV + JSON)
    archive.append(convertToCSV(roiMetrics, 'roi'), { name: 'roi_metrics.csv' });
    archive.append(JSON.stringify(roiMetrics, null, 2), { name: 'roi_metrics.json' });

    // Add compliance health metrics (CSV + JSON)
    archive.append(convertToCSV(complianceMetrics, 'compliance'), { name: 'compliance_health.csv' });
    archive.append(JSON.stringify(complianceMetrics, null, 2), { name: 'compliance_health.json' });

    // Add supply/demand heatmap (CSV + JSON)
    archive.append(convertToCSV(supplyDemandMetrics, 'supplyDemand'), { name: 'supply_demand_heatmap.csv' });
    archive.append(JSON.stringify(supplyDemandMetrics, null, 2), { name: 'supply_demand_heatmap.json' });

    // Add job funnel metrics (CSV + JSON)
    archive.append(convertToCSV(jobFunnelMetrics, 'jobFunnel'), { name: 'job_funnel_metrics.csv' });
    archive.append(JSON.stringify(jobFunnelMetrics, null, 2), { name: 'job_funnel_metrics.json' });

    // Add org growth metrics (CSV + JSON)
    archive.append(convertToCSV(orgGrowthMetrics, 'orgGrowth'), { name: 'org_growth_metrics.csv' });
    archive.append(JSON.stringify(orgGrowthMetrics, null, 2), { name: 'org_growth_metrics.json' });

    // Add executive summary (markdown)
    const summary = generateExecutiveSummary(
      roiMetrics,
      complianceMetrics,
      supplyDemandMetrics,
      jobFunnelMetrics,
      orgGrowthMetrics,
      quarterStart,
      quarterEnd
    );
    archive.append(summary, { name: 'EXECUTIVE_SUMMARY.md' });

    // Add metadata
    const metadata = {
      exportDate: new Date().toISOString(),
      periodStart: quarterStart.toISOString(),
      periodEnd: quarterEnd.toISOString(),
      exportId,
      includeOrgDetails: includeOrgDetails || false,
      files: [
        'roi_metrics.csv',
        'roi_metrics.json',
        'compliance_health.csv',
        'compliance_health.json',
        'supply_demand_heatmap.csv',
        'supply_demand_heatmap.json',
        'job_funnel_metrics.csv',
        'job_funnel_metrics.json',
        'org_growth_metrics.csv',
        'org_growth_metrics.json',
        'EXECUTIVE_SUMMARY.md',
      ],
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Error generating quarterly export:', error);
    res.status(500).json({
      error: 'Failed to generate quarterly export',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /exec/quarterly-export/preview
 * Preview metrics that would be included in the export
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const quarterStart = getQuarterStart(new Date());
    const quarterEnd = getQuarterEnd(new Date());

    const [
      roiMetrics,
      complianceMetrics,
      supplyDemandMetrics,
      jobFunnelMetrics,
      orgGrowthMetrics,
    ] = await Promise.all([
      fetchROIMetrics(quarterStart, quarterEnd),
      fetchComplianceMetrics(),
      fetchSupplyDemandMetrics(),
      fetchJobFunnelMetrics(quarterStart, quarterEnd),
      fetchOrgGrowthMetrics(quarterStart, quarterEnd),
    ]);

    res.json({
      periodStart: quarterStart.toISOString(),
      periodEnd: quarterEnd.toISOString(),
      summary: {
        roiMetricsCount: roiMetrics.length,
        complianceMetricsCount: complianceMetrics.length,
        supplyDemandMetricsCount: supplyDemandMetrics.length,
        jobFunnelMetricsCount: jobFunnelMetrics.length,
        orgGrowthMetricsCount: orgGrowthMetrics.length,
      },
      preview: {
        roi: roiMetrics.slice(0, 5),
        compliance: complianceMetrics.slice(0, 5),
        supplyDemand: supplyDemandMetrics.slice(0, 5),
        jobFunnel: jobFunnelMetrics.slice(0, 5),
        orgGrowth: orgGrowthMetrics.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper functions

function getQuarterStart(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function getQuarterEnd(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
}

async function fetchROIMetrics(startDate: Date, endDate: Date): Promise<ROIMetric[]> {
  // TODO: Replace with actual database query
  // SELECT * FROM org_roi WHERE period_month >= $1 AND period_month <= $2
  return generateSyntheticROIMetrics(startDate, endDate);
}

async function fetchComplianceMetrics(): Promise<ComplianceHealthMetric[]> {
  // TODO: Replace with actual database query
  // SELECT * FROM compliance_health
  return generateSyntheticComplianceMetrics();
}

async function fetchSupplyDemandMetrics(): Promise<SupplyDemandMetric[]> {
  // TODO: Replace with actual database query
  // SELECT * FROM heatmap_supply_demand
  return generateSyntheticSupplyDemandMetrics();
}

async function fetchJobFunnelMetrics(startDate: Date, endDate: Date): Promise<JobFunnelMetric[]> {
  // TODO: Replace with actual database query
  // Aggregate from Application table
  return generateSyntheticJobFunnelMetrics(startDate, endDate);
}

async function fetchOrgGrowthMetrics(startDate: Date, endDate: Date): Promise<OrgGrowthMetric[]> {
  // TODO: Replace with actual database query
  // Aggregate from User and Organization tables
  return generateSyntheticOrgGrowthMetrics(startDate, endDate);
}

function convertToCSV(data: any[], type: string): string {
  if (data.length === 0) return '';

  // Extract headers from first object
  const headers = Object.keys(data[0]);
  const csv: string[] = [headers.join(',')];

  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle null/undefined
      if (value === null || value === undefined) return '';
      // Handle strings with commas/quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value.toString();
    });
    csv.push(values.join(','));
  }

  return csv.join('\n');
}

function generateExecutiveSummary(
  roiMetrics: ROIMetric[],
  complianceMetrics: ComplianceHealthMetric[],
  supplyDemandMetrics: SupplyDemandMetric[],
  jobFunnelMetrics: JobFunnelMetric[],
  orgGrowthMetrics: OrgGrowthMetric[],
  startDate: Date,
  endDate: Date
): string {
  const totalROI = roiMetrics.reduce((sum, m) => sum + m.total_roi_usd, 0);
  const avgComplianceScore = complianceMetrics.length > 0
    ? complianceMetrics.reduce((sum, m) => sum + m.total_score, 0) / complianceMetrics.length
    : 0;
  const totalJobsOpen = supplyDemandMetrics.reduce((sum, m) => sum + m.jobs_open, 0);
  const totalClinicians = supplyDemandMetrics.reduce((sum, m) => sum + m.clinicians_available, 0);
  const totalApplications = jobFunnelMetrics.reduce((sum, m) => sum + m.total_applications, 0);

  return `# Executive Summary - Quarterly Analytics

## Period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}
Generated: ${new Date().toISOString()}

---

## Key Performance Indicators

### 1. Return on Investment (ROI)
- **Total Platform ROI**: $${totalROI.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- **Organizations Tracked**: ${new Set(roiMetrics.map(m => m.org_id)).size}
- **Credentials Completed**: ${roiMetrics.reduce((sum, m) => sum + m.completed_credentials, 0).toLocaleString()}
- **Average Time Reduction**: ${roiMetrics.length > 0 ? (roiMetrics.reduce((sum, m) => sum + m.time_reduction_pct, 0) / roiMetrics.length).toFixed(1) : 0}%

**Insight**: Platform credentialing is significantly faster than traditional processes, resulting in substantial cost savings and revenue acceleration for partner organizations.

### 2. Compliance Health
- **Average Compliance Score**: ${avgComplianceScore.toFixed(1)}/100
- **Organizations Monitored**: ${complianceMetrics.length}
- **Excellent Grade (90+)**: ${complianceMetrics.filter(m => m.health_grade === 'excellent').length}
- **Need Improvement (<75)**: ${complianceMetrics.filter(m => m.total_score < 75).length}

**Insight**: ${avgComplianceScore >= 80 ? 'Strong' : avgComplianceScore >= 70 ? 'Adequate' : 'Concerning'} compliance posture across the platform. ${complianceMetrics.filter(m => m.total_score < 75).length > 0 ? 'Focus needed on organizations below 75 score.' : 'All organizations meeting minimum thresholds.'}

### 3. Supply & Demand
- **Total Open Positions**: ${totalJobsOpen.toLocaleString()}
- **Available Clinicians**: ${totalClinicians.toLocaleString()}
- **Supply/Demand Ratio**: ${totalJobsOpen > 0 ? (totalClinicians / totalJobsOpen).toFixed(2) : 'N/A'}
- **Estimated Fillable Positions**: ${supplyDemandMetrics.reduce((sum, m) => sum + m.estimated_fillable_positions, 0).toLocaleString()}

**Insight**: ${totalClinicians > totalJobsOpen ? 'Adequate' : 'Limited'} clinician supply relative to market demand. ${supplyDemandMetrics.filter(m => m.market_status === 'critical_shortage').length} regions identified with critical shortages.

### 4. Job Funnel Performance
- **Total Applications**: ${totalApplications.toLocaleString()}
- **Accepted Applications**: ${jobFunnelMetrics.reduce((sum, m) => sum + m.applications_accepted, 0).toLocaleString()}
- **Average Conversion Rate**: ${jobFunnelMetrics.length > 0 ? (jobFunnelMetrics.reduce((sum, m) => sum + m.conversion_rate_pct, 0) / jobFunnelMetrics.length).toFixed(1) : 0}%
- **Average Match Score**: ${jobFunnelMetrics.length > 0 ? (jobFunnelMetrics.reduce((sum, m) => sum + m.avg_match_score, 0) / jobFunnelMetrics.length).toFixed(2) : 0}

**Insight**: Strong matching performance with high-quality candidate-to-job alignment.

### 5. Organization Growth
- **New Organizations**: ${orgGrowthMetrics.reduce((sum, m) => sum + m.new_orgs, 0)}
- **Active Organizations**: ${orgGrowthMetrics.length > 0 ? orgGrowthMetrics[orgGrowthMetrics.length - 1].active_orgs : 0}
- **New Clinicians Onboarded**: ${orgGrowthMetrics.reduce((sum, m) => sum + m.new_clinicians, 0).toLocaleString()}
- **Quarter-over-Quarter Growth**: ${orgGrowthMetrics.length > 0 ? (orgGrowthMetrics.reduce((sum, m) => sum + m.growth_rate_pct, 0) / orgGrowthMetrics.length).toFixed(1) : 0}%

**Insight**: ${orgGrowthMetrics.reduce((sum, m) => sum + m.growth_rate_pct, 0) / orgGrowthMetrics.length > 10 ? 'Rapid' : 'Steady'} platform growth trajectory with increasing adoption.

---

## Strategic Recommendations

1. **ROI Optimization**: Continue to reduce credentialing time through process automation and AI-powered verification.

2. **Compliance Focus**: Provide targeted support to organizations with compliance scores below 75 to bring them up to standard.

3. **Market Expansion**: Address critical shortage regions through targeted clinician recruitment and compact license enablement.

4. **Matching Enhancement**: Maintain high match scores while increasing conversion rates through improved job recommendation algorithms.

5. **Growth Acceleration**: Scale operations to support increasing organizational adoption and clinician onboarding volume.

---

## Data Files Included

- \`roi_metrics.csv\` / \`roi_metrics.json\` - Detailed ROI calculations by organization and month
- \`compliance_health.csv\` / \`compliance_health.json\` - Compliance health scores and component breakdowns
- \`supply_demand_heatmap.csv\` / \`supply_demand_heatmap.json\` - Geographic supply/demand data for visualization
- \`job_funnel_metrics.csv\` / \`job_funnel_metrics.json\` - Application funnel and conversion metrics
- \`org_growth_metrics.csv\` / \`org_growth_metrics.json\` - Platform growth and adoption trends

---

*This report is confidential and intended for executive leadership only.*
`;
}

// Synthetic data generators for testing

function generateSyntheticROIMetrics(startDate: Date, endDate: Date): ROIMetric[] {
  const metrics: ROIMetric[] = [];
  const orgIds = ['org-001', 'org-002', 'org-003', 'org-004', 'org-005'];
  const months = getMonthsBetween(startDate, endDate);

  for (const month of months) {
    for (const orgId of orgIds) {
      const credentialsCompleted = Math.floor(Math.random() * 50) + 20;
      const avgDaysPlatform = Math.random() * 7 + 7; // 7-14 days
      const avgDaysTraditional = 95;
      const daysSaved = (avgDaysTraditional - avgDaysPlatform) * credentialsCompleted;

      metrics.push({
        period_month: month,
        org_id: orgId,
        total_credentials_processed: credentialsCompleted + 5,
        completed_credentials: credentialsCompleted,
        avg_days_platform: parseFloat(avgDaysPlatform.toFixed(1)),
        avg_days_traditional: avgDaysTraditional,
        days_saved_per_credential: parseFloat((avgDaysTraditional - avgDaysPlatform).toFixed(1)),
        total_days_saved: parseFloat(daysSaved.toFixed(1)),
        admin_cost_savings_usd: parseFloat((credentialsCompleted * 30 * 50 * 0.7).toFixed(2)),
        revenue_acceleration_usd: parseFloat((daysSaved * 500).toFixed(2)),
        total_roi_usd: parseFloat((credentialsCompleted * 30 * 50 * 0.7 + daysSaved * 500).toFixed(2)),
        time_reduction_pct: parseFloat(((1 - avgDaysPlatform / avgDaysTraditional) * 100).toFixed(1)),
        roi_per_credential_usd: parseFloat(((credentialsCompleted * 30 * 50 * 0.7 + daysSaved * 500) / credentialsCompleted).toFixed(2)),
        performance_tier: avgDaysPlatform <= 10 ? 'excellent' : avgDaysPlatform <= 14 ? 'good' : 'average',
      });
    }
  }

  return metrics;
}

function generateSyntheticComplianceMetrics(): ComplianceHealthMetric[] {
  const metrics: ComplianceHealthMetric[] = [];
  const orgIds = ['org-001', 'org-002', 'org-003', 'org-004', 'org-005'];

  for (const orgId of orgIds) {
    const totalClinicians = Math.floor(Math.random() * 100) + 50;
    const cliniciansWithNpi = Math.floor(totalClinicians * (0.8 + Math.random() * 0.15));
    const ncqaScore = Math.random() * 10 + 20; // 20-30
    const psvScore = Math.random() * 8 + 17; // 17-25
    const privilegesScore = Math.random() * 8 + 17; // 17-25
    const payerScore = Math.random() * 6 + 14; // 14-20
    const totalScore = ncqaScore + psvScore + privilegesScore + payerScore;

    metrics.push({
      org_id: orgId,
      total_clinicians: totalClinicians,
      clinicians_with_npi: cliniciansWithNpi,
      ncqa_score: parseFloat(ncqaScore.toFixed(1)),
      psv_score: parseFloat(psvScore.toFixed(1)),
      privileges_score: parseFloat(privilegesScore.toFixed(1)),
      payer_score: parseFloat(payerScore.toFixed(1)),
      total_score: parseFloat(totalScore.toFixed(1)),
      health_grade:
        totalScore >= 90 ? 'excellent' : totalScore >= 75 ? 'good' : totalScore >= 60 ? 'fair' : 'poor',
      computed_at: new Date().toISOString(),
    });
  }

  return metrics;
}

function generateSyntheticSupplyDemandMetrics(): SupplyDemandMetric[] {
  const metrics: SupplyDemandMetric[] = [];
  const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
  const specialties = ['207Q00000X', '207R00000X', '208D00000X', '207V00000X'];

  for (const state of states) {
    for (const specialty of specialties) {
      const jobsOpen = Math.floor(Math.random() * 50) + 10;
      const cliniciansAvailable = Math.floor(jobsOpen * (0.5 + Math.random() * 1.5));
      const ratio = cliniciansAvailable / jobsOpen;

      metrics.push({
        state,
        specialty_code: specialty,
        lat: 35 + Math.random() * 15,
        lon: -120 + Math.random() * 40,
        jobs_open: jobsOpen,
        clinicians_available: cliniciansAvailable,
        supply_demand_ratio: parseFloat(ratio.toFixed(2)),
        estimated_fillable_positions: Math.min(jobsOpen, cliniciansAvailable),
        market_status:
          ratio >= 2.0
            ? 'oversupply'
            : ratio >= 1.0
            ? 'balanced'
            : ratio >= 0.5
            ? 'shortage'
            : 'critical_shortage',
        opportunity_score: Math.floor(Math.min(100, 50 + ratio * 25)),
      });
    }
  }

  return metrics;
}

function generateSyntheticJobFunnelMetrics(startDate: Date, endDate: Date): JobFunnelMetric[] {
  const metrics: JobFunnelMetric[] = [];
  const months = getMonthsBetween(startDate, endDate);

  for (const month of months) {
    const totalApplications = Math.floor(Math.random() * 300) + 200;
    const pending = Math.floor(totalApplications * 0.15);
    const reviewed = totalApplications - pending;
    const accepted = Math.floor(reviewed * 0.4);
    const rejected = reviewed - accepted;

    metrics.push({
      period_month: month,
      total_applications: totalApplications,
      applications_pending: pending,
      applications_reviewed: reviewed,
      applications_accepted: accepted,
      applications_rejected: rejected,
      avg_match_score: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
      median_match_score: parseFloat((0.78 + Math.random() * 0.15).toFixed(2)),
      conversion_rate_pct: parseFloat(((accepted / totalApplications) * 100).toFixed(1)),
    });
  }

  return metrics;
}

function generateSyntheticOrgGrowthMetrics(startDate: Date, endDate: Date): OrgGrowthMetric[] {
  const metrics: OrgGrowthMetric[] = [];
  const months = getMonthsBetween(startDate, endDate);
  let activeOrgs = 40;
  let activeClinicians = 1200;

  for (const month of months) {
    const newOrgs = Math.floor(Math.random() * 5) + 2;
    const newClinicians = Math.floor(Math.random() * 100) + 50;
    activeOrgs += newOrgs;
    activeClinicians += newClinicians;

    metrics.push({
      period_month: month,
      new_orgs: newOrgs,
      active_orgs: activeOrgs,
      new_clinicians: newClinicians,
      active_clinicians: activeClinicians,
      total_credentials_issued: Math.floor(activeClinicians * 0.8),
      growth_rate_pct: parseFloat(((newClinicians / (activeClinicians - newClinicians)) * 100).toFixed(1)),
    });
  }

  return metrics;
}

function getMonthsBetween(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    months.push(current.toISOString().slice(0, 7) + '-01');
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export default router;

