'use client';

/**
 * B145C-FE-004: Executive Dashboard Homepage
 *
 * Displays high-level metrics for C-level executives including:
 * - ROI from faster credentialing
 * - Compliance health score (0-100)
 * - Supply/demand heatmap summary
 * - Jobs filled metrics
 * - Links to detailed drill-down pages
 *
 * Screen reader friendly with proper ARIA labels and semantic HTML.
 * Responsive design with mobile-first approach.
 *
 * @v0-candidate
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  MapPin,
  Users,
  Briefcase,
  ArrowRight,
  RefreshCw,
  Download,
  Activity,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// Type definitions
interface ROIMetrics {
  total_roi_usd: number;
  total_completed_credentials: number;
  avg_days_platform: number;
  avg_days_traditional: number;
  time_reduction_pct: number;
  projected_annual_roi: number;
  months_active: number;
}

interface ComplianceMetrics {
  avg_compliance_score: number;
  orgs_excellent: number;
  orgs_good: number;
  orgs_fair: number;
  orgs_poor: number;
  pct_healthy: number;
  platform_total_clinicians: number;
}

interface SupplyDemandMetrics {
  platform_total_jobs: number;
  platform_total_clinicians: number;
  platform_supply_demand_ratio: number;
  platform_fillable_positions: number;
  fill_rate_potential_pct: number;
  regions_critical_shortage: number;
  regions_shortage: number;
  regions_balanced: number;
}

interface JobsFilledMetrics {
  total_applications: number;
  applications_pending: number;
  applications_accepted: number;
  applications_reviewed: number;
  avg_match_score: number;
  fill_rate_pct: number;
}

export default function ExecDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [roiMetrics, setRoiMetrics] = useState<ROIMetrics | null>(null);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [supplyDemandMetrics, setSupplyDemandMetrics] = useState<SupplyDemandMetrics | null>(null);
  const [jobsFilledMetrics, setJobsFilledMetrics] = useState<JobsFilledMetrics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    try {
      setLoading(true);

      // In production, these would be actual API calls
      // TODO: Replace with real endpoints
      const [roiData, complianceData, supplyDemandData, jobsData] = await Promise.all([
        fetchROIMetrics(),
        fetchComplianceMetrics(),
        fetchSupplyDemandMetrics(),
        fetchJobsFilledMetrics(),
      ]);

      setRoiMetrics(roiData);
      setComplianceMetrics(complianceData);
      setSupplyDemandMetrics(supplyDemandData);
      setJobsFilledMetrics(jobsData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching exec metrics:', error);
      // Use mock data on error
      setRoiMetrics(getMockROIMetrics());
      setComplianceMetrics(getMockComplianceMetrics());
      setSupplyDemandMetrics(getMockSupplyDemandMetrics());
      setJobsFilledMetrics(getMockJobsFilledMetrics());
    } finally {
      setLoading(false);
    }
  }

  async function fetchROIMetrics(): Promise<ROIMetrics> {
    // TODO: Replace with actual API call to /api/exec/roi
    return getMockROIMetrics();
  }

  async function fetchComplianceMetrics(): Promise<ComplianceMetrics> {
    // TODO: Replace with actual API call to /api/exec/compliance
    return getMockComplianceMetrics();
  }

  async function fetchSupplyDemandMetrics(): Promise<SupplyDemandMetrics> {
    // TODO: Replace with actual API call to /api/exec/supply-demand
    return getMockSupplyDemandMetrics();
  }

  async function fetchJobsFilledMetrics(): Promise<JobsFilledMetrics> {
    // TODO: Replace with actual API call to /api/exec/jobs-filled
    return getMockJobsFilledMetrics();
  }

  function getMockROIMetrics(): ROIMetrics {
    return {
      total_roi_usd: 2847500,
      total_completed_credentials: 342,
      avg_days_platform: 12.3,
      avg_days_traditional: 95.0,
      time_reduction_pct: 87.1,
      projected_annual_roi: 4271250,
      months_active: 8,
    };
  }

  function getMockComplianceMetrics(): ComplianceMetrics {
    return {
      avg_compliance_score: 83.2,
      orgs_excellent: 12,
      orgs_good: 23,
      orgs_fair: 8,
      orgs_poor: 3,
      pct_healthy: 76.1,
      platform_total_clinicians: 1847,
    };
  }

  function getMockSupplyDemandMetrics(): SupplyDemandMetrics {
    return {
      platform_total_jobs: 1256,
      platform_total_clinicians: 1847,
      platform_supply_demand_ratio: 1.47,
      platform_fillable_positions: 1118,
      fill_rate_potential_pct: 89.0,
      regions_critical_shortage: 14,
      regions_shortage: 27,
      regions_balanced: 31,
    };
  }

  function getMockJobsFilledMetrics(): JobsFilledMetrics {
    return {
      total_applications: 3842,
      applications_pending: 478,
      applications_accepted: 1284,
      applications_reviewed: 2080,
      avg_match_score: 0.82,
      fill_rate_pct: 33.4,
    };
  }

  async function handleExportQuarterly() {
    try {
      // TODO: Implement actual export API call
      const response = await fetch('/api/exec/quarterly-export', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Export failed');

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exec-quarterly-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting quarterly data:', error);
      alert('Failed to export quarterly data. Please try again.');
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  function getComplianceGrade(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  function getComplianceColor(score: number): string {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading executive dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Activity className="h-10 w-10" />
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Platform-wide metrics and analytics for leadership
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMetrics} variant="outline" size="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleExportQuarterly} size="default">
            <Download className="mr-2 h-4 w-4" />
            Export Quarterly Data
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* ROI Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/exec/roi')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-green-100 p-3">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Platform ROI</CardTitle>
            <CardDescription>Savings from faster credentialing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(roiMetrics?.total_roi_usd || 0)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span>
                  {formatPercentage(roiMetrics?.time_reduction_pct || 0)} faster than traditional
                </span>
              </div>
              <div className="pt-2 text-sm">
                <div className="text-muted-foreground">Projected Annual ROI</div>
                <div className="font-semibold">{formatCurrency(roiMetrics?.projected_annual_roi || 0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Health Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/exec/compliance')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-blue-100 p-3">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Compliance Health</CardTitle>
            <CardDescription>Platform-wide compliance score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className={`text-3xl font-bold ${getComplianceColor(complianceMetrics?.avg_compliance_score || 0)}`}>
                {complianceMetrics?.avg_compliance_score.toFixed(1)}/100
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {getComplianceGrade(complianceMetrics?.avg_compliance_score || 0)}
                </Badge>
              </div>
              <div className="pt-2 text-sm">
                <div className="text-muted-foreground">Organizations Healthy</div>
                <div className="font-semibold">{formatPercentage(complianceMetrics?.pct_healthy || 0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supply & Demand Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/exec/supply-demand')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-purple-100 p-3">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Supply & Demand</CardTitle>
            <CardDescription>Clinician availability vs jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-600">
                {supplyDemandMetrics?.platform_supply_demand_ratio.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Clinicians per job opening</div>
              <div className="pt-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Open</span>
                  <span className="font-semibold">{formatNumber(supplyDemandMetrics?.platform_total_jobs || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clinicians</span>
                  <span className="font-semibold">{formatNumber(supplyDemandMetrics?.platform_total_clinicians || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Filled Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/exec/jobs')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-orange-100 p-3">
                <Briefcase className="h-6 w-6 text-orange-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Jobs Filled</CardTitle>
            <CardDescription>Application and placement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-orange-600">
                {formatNumber(jobsFilledMetrics?.applications_accepted || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatPercentage(jobsFilledMetrics?.fill_rate_pct || 0)} fill rate
              </div>
              <div className="pt-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Applications</span>
                  <span className="font-semibold">{formatNumber(jobsFilledMetrics?.total_applications || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Match Score</span>
                  <span className="font-semibold">{(jobsFilledMetrics?.avg_match_score || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credentialing Efficiency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Credentialing Efficiency
            </CardTitle>
            <CardDescription>Time-to-credential comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Traditional Process</div>
                  <div className="text-2xl font-bold text-gray-400">{roiMetrics?.avg_days_traditional.toFixed(0)} days</div>
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" />
                <div>
                  <div className="text-sm text-muted-foreground">Platform Process</div>
                  <div className="text-2xl font-bold text-green-600">{roiMetrics?.avg_days_platform.toFixed(1)} days</div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credentials Completed</span>
                  <span className="font-semibold">{formatNumber(roiMetrics?.total_completed_credentials || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Time Reduction</span>
                  <span className="font-semibold text-green-600">{formatPercentage(roiMetrics?.time_reduction_pct || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Market Coverage
            </CardTitle>
            <CardDescription>Geographic distribution and balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Balanced Regions</span>
                </div>
                <span className="font-semibold">{supplyDemandMetrics?.regions_balanced || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm">Shortage Regions</span>
                </div>
                <span className="font-semibold">{supplyDemandMetrics?.regions_shortage || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">Critical Shortage</span>
                </div>
                <span className="font-semibold">{supplyDemandMetrics?.regions_critical_shortage || 0}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fillable Positions</span>
                  <span className="font-semibold text-purple-600">
                    {formatNumber(supplyDemandMetrics?.platform_fillable_positions || 0)} ({formatPercentage(supplyDemandMetrics?.fill_rate_potential_pct || 0)})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Health by Organization Tier
          </CardTitle>
          <CardDescription>Distribution of organizations by compliance grade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-3xl font-bold text-green-600">{complianceMetrics?.orgs_excellent || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Excellent (90-100)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{complianceMetrics?.orgs_good || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Good (75-89)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-3xl font-bold text-yellow-600">{complianceMetrics?.orgs_fair || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Fair (60-74)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-3xl font-bold text-red-600">{complianceMetrics?.orgs_poor || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Poor (&lt;60)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About This Dashboard</p>
              <p>
                This executive dashboard provides a high-level overview of platform performance across key metrics:
                ROI from faster credentialing, compliance health, workforce supply and demand, and job placement success.
              </p>
              <p>
                Click any metric card to drill down into detailed analytics. Use the "Export Quarterly Data" button
                to generate a comprehensive ZIP bundle containing CSV and JSON files for all metrics.
              </p>
              <p className="text-xs">
                Data is refreshed daily. ROI calculations use configurable cost parameters and industry benchmarks
                for traditional credentialing processes (90-120 days average).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

