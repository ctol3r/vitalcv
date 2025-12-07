'use client';

/**
 * B145B-FE-005: Org 'Recruitment Insights' dashboard
 *
 * Charts for:
 * - Clinician retention (90-day)
 * - Time-to-hire distribution
 * - Pipeline funnel
 * - Match quality scores
 * - Geographic mobility
 * - Paperwork time savings
 *
 * Filters by location/specialty
 * Mobile-optimized
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import {
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  MapPin,
  FileCheck,
  Award,
  Download,
  Filter,
  Calendar
} from 'lucide-react';

interface RetentionMetrics {
  cohortMonth: string;
  cohortSize: number;
  retainedCount: number;
  retentionRatePct: number;
  avgDaysToFirstApp: number;
}

interface TimeToHireMetrics {
  hireBucket: string;
  jobCount: number;
  avgDaysToHire: number;
}

interface PipelineMetrics {
  periodMonth: string;
  totalApplications: number;
  applicationsCount: number;
  reviewedCount: number;
  hiredCount: number;
  appliedToReviewedPct: number;
  reviewedToHiredPct: number;
  appliedToHiredPct: number;
}

interface MobilityMetrics {
  jobSpecialty: string;
  modality: string;
  totalHires: number;
  avgDistanceMiles: number;
  sameStatePct: number;
  localCount: number;
  regionalCount: number;
  multiStateCount: number;
  nationalCount: number;
}

interface PaperworkSavings {
  periodMonth: string;
  credentialVerifications: number;
  applicationReviews: number;
  documentsProcessed: number;
  totalHoursSaved: number;
  costSavingsUsd: number;
}

interface DashboardData {
  retention: RetentionMetrics[];
  timeToHire: TimeToHireMetrics[];
  pipeline: PipelineMetrics[];
  mobility: MobilityMetrics[];
  paperworkSavings: PaperworkSavings[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function RecruitmentInsightsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '6m' | '1y'>('90d');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          timeRange,
          location: selectedLocation,
          specialty: selectedSpecialty,
        });

        const response = await fetch(`/api/analytics/recruitment?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [timeRange, selectedLocation, selectedSpecialty]);

  const handleExport = async () => {
    if (!data) return;

    const csv = generateCSVReport(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruitment-insights-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">{error || 'No data available'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate summary metrics
  const latestRetention = data.retention[0] || { retentionRatePct: 0, cohortSize: 0 };
  const latestPipeline = data.pipeline[0] || { appliedToHiredPct: 0, hiredCount: 0 };
  const totalPaperworkSavings = data.paperworkSavings.reduce((sum, m) => sum + m.costSavingsUsd, 0);
  const avgTimeToHire = data.timeToHire.reduce((sum, m) => sum + m.avgDaysToHire, 0) / (data.timeToHire.length || 1);

  // Prepare funnel data
  const funnelData = data.pipeline.length > 0 ? [
    { name: 'Applications', value: data.pipeline[0].applicationsCount, fill: '#8884d8' },
    { name: 'Reviewed', value: data.pipeline[0].reviewedCount, fill: '#82ca9d' },
    { name: 'Hired', value: data.pipeline[0].hiredCount, fill: '#ffc658' },
  ] : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Recruitment Insights</h1>
          <p className="text-gray-600">
            Analytics for clinician retention, hiring efficiency, and ROI
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="NY">New York</SelectItem>
              <SelectItem value="CA">California</SelectItem>
              <SelectItem value="TX">Texas</SelectItem>
              <SelectItem value="FL">Florida</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              <SelectItem value="207R00000X">Internal Medicine</SelectItem>
              <SelectItem value="208D00000X">General Practice</SelectItem>
              <SelectItem value="2084P0800X">Psychiatry</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              90-Day Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{latestRetention.retentionRatePct.toFixed(1)}%</div>
            <p className="text-xs text-gray-600 mt-1">{latestRetention.cohortSize} clinicians in cohort</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Time-to-Hire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgTimeToHire.toFixed(0)} days</div>
            <Badge variant="outline" className="mt-1">
              {avgTimeToHire <= 14 ? 'Fast' : avgTimeToHire <= 30 ? 'Normal' : 'Slow'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Hire Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{latestPipeline.appliedToHiredPct.toFixed(1)}%</div>
            <p className="text-xs text-gray-600 mt-1">{latestPipeline.hiredCount} hires this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Time Saved (AI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(totalPaperworkSavings / 1000).toFixed(0)}k</div>
            <p className="text-xs text-gray-600 mt-1">Paperwork automation ROI</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="retention" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="timeToHire">Time-to-Hire</TabsTrigger>
          <TabsTrigger value="mobility">Mobility</TabsTrigger>
          <TabsTrigger value="roi">ROI</TabsTrigger>
        </TabsList>

        {/* Retention Tab */}
        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinician Retention Rate (90-Day)</CardTitle>
              <CardDescription>
                % of clinicians who complete ≥1 job match within 90 days of signup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data.retention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="cohortMonth"
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Retention Rate']}
                    labelFormatter={(label) => `Cohort: ${new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="retentionRatePct"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Retention Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Time to First Application</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.retention}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="cohortMonth"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                    />
                    <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="avgDaysToFirstApp" fill="#82ca9d" name="Avg Days" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cohort Sizes</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.retention}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="cohortMonth"
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cohortSize" fill="#8884d8" name="Cohort Size" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recruitment Funnel</CardTitle>
                <CardDescription>Current period conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates</CardTitle>
                <CardDescription>Stage-to-stage conversion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Applied → Reviewed</span>
                      <Badge>{latestPipeline.appliedToReviewedPct?.toFixed(1) || 0}%</Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: `${Math.min(latestPipeline.appliedToReviewedPct || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Reviewed → Hired</span>
                      <Badge>{latestPipeline.reviewedToHiredPct?.toFixed(1) || 0}%</Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${Math.min(latestPipeline.reviewedToHiredPct || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Applied → Hired</span>
                      <Badge variant="default">{latestPipeline.appliedToHiredPct?.toFixed(1) || 0}%</Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-purple-500 h-3 rounded-full"
                        style={{ width: `${Math.min(latestPipeline.appliedToHiredPct || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.pipeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodMonth"
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="applicationsCount" stackId="1" stroke="#8884d8" fill="#8884d8" name="Applications" />
                  <Area type="monotone" dataKey="reviewedCount" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Reviewed" />
                  <Area type="monotone" dataKey="hiredCount" stackId="1" stroke="#ffc658" fill="#ffc658" name="Hired" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time-to-Hire Tab */}
        <TabsContent value="timeToHire" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time-to-Hire Distribution</CardTitle>
              <CardDescription>Histogram by duration buckets</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.timeToHire}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hireBucket" />
                  <YAxis label={{ value: 'Job Count', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="jobCount" fill="#8884d8" name="Jobs" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Days by Bucket</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.timeToHire.map((bucket, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <div>
                        <div className="font-medium">{bucket.hireBucket}</div>
                        <div className="text-sm text-gray-600">{bucket.jobCount} jobs</div>
                      </div>
                    </div>
                    <Badge variant="outline">{bucket.avgDaysToHire?.toFixed(0) || 'N/A'} days</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mobility Tab */}
        <TabsContent value="mobility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Mobility by Specialty</CardTitle>
              <CardDescription>Distance traveled for accepted roles</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.mobility}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="jobSpecialty" />
                  <YAxis label={{ value: 'Miles', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgDistanceMiles" fill="#82ca9d" name="Avg Distance" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mobility Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.mobility.length > 0 && (
                  <>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{data.mobility[0].localCount || 0}</div>
                      <div className="text-sm text-gray-600">Local (&lt;25mi)</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{data.mobility[0].regionalCount || 0}</div>
                      <div className="text-sm text-gray-600">Regional (25-100mi)</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{data.mobility[0].multiStateCount || 0}</div>
                      <div className="text-sm text-gray-600">Multi-State (100-500mi)</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{data.mobility[0].nationalCount || 0}</div>
                      <div className="text-sm text-gray-600">National (&gt;500mi)</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROI Tab */}
        <TabsContent value="roi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Paperwork Time Savings (AI Automation)</CardTitle>
              <CardDescription>ROI from AI-powered verification and matching</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={data.paperworkSavings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="periodMonth"
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                  />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value.toFixed(1)} hours`} />
                  <Legend />
                  <Area type="monotone" dataKey="totalHoursSaved" stroke="#8884d8" fill="#8884d8" name="Hours Saved" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Credential Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.paperworkSavings.reduce((sum, m) => sum + m.credentialVerifications, 0)}
                </div>
                <p className="text-xs text-gray-600 mt-1">28 min saved per verification</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Application Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.paperworkSavings.reduce((sum, m) => sum + m.applicationReviews, 0)}
                </div>
                <p className="text-xs text-gray-600 mt-1">10 min saved per review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Documents Processed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.paperworkSavings.reduce((sum, m) => sum + m.documentsProcessed, 0)}
                </div>
                <p className="text-xs text-gray-600 mt-1">19 min saved per document</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Total Cost Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="text-5xl font-bold text-green-600 mb-2">
                  ${totalPaperworkSavings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-gray-600">Total savings from AI automation (at $50/hour labor cost)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function generateCSVReport(data: DashboardData): string {
  let csv = '# Recruitment Insights Report\n\n';

  csv += '## Retention Metrics\n';
  csv += 'Cohort Month,Cohort Size,Retained Count,Retention Rate %,Avg Days to First App\n';
  data.retention.forEach(r => {
    csv += `${r.cohortMonth},${r.cohortSize},${r.retainedCount},${r.retentionRatePct},${r.avgDaysToFirstApp}\n`;
  });

  csv += '\n## Time-to-Hire Distribution\n';
  csv += 'Hire Bucket,Job Count,Avg Days to Hire\n';
  data.timeToHire.forEach(t => {
    csv += `${t.hireBucket},${t.jobCount},${t.avgDaysToHire}\n`;
  });

  csv += '\n## Pipeline Metrics\n';
  csv += 'Period,Applications,Reviewed,Hired,Applied→Reviewed %,Reviewed→Hired %,Applied→Hired %\n';
  data.pipeline.forEach(p => {
    csv += `${p.periodMonth},${p.applicationsCount},${p.reviewedCount},${p.hiredCount},${p.appliedToReviewedPct},${p.reviewedToHiredPct},${p.appliedToHiredPct}\n`;
  });

  return csv;
}

