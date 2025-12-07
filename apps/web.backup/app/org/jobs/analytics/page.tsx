'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Cell
} from 'recharts';
import {
  Eye,
  MousePointer,
  FileText,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Download
} from 'lucide-react';

interface JobFunnelMetrics {
  jobId: string;
  jobTitle: string;
  views: number;
  clicks: number;
  applies: number;
  hired: number;
  viewToClickRate: number;
  clickToApplyRate: number;
  applyToHireRate: number;
  overallConversionRate: number;
}

interface PartnerMetrics {
  partnerId: string;
  partnerName: string;
  totalJobs: number;
  totalViews: number;
  totalClicks: number;
  totalApplies: number;
  totalHired: number;
  avgViewToClickRate: number;
  avgClickToApplyRate: number;
  avgApplyToHireRate: number;
  avgOverallConversionRate: number;
  jobMetrics: JobFunnelMetrics[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function EmployerAnalyticsPage() {
  const [metrics, setMetrics] = useState<PartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        // In production, get partnerId from session/auth
        const partnerId = 'current-partner-id'; // TODO: Get from auth context

        const response = await fetch(`/api/analytics/partner/${partnerId}?timeRange=${timeRange}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

  const handleExport = async () => {
    if (!metrics) return;

    const csv = generateCSVReport(metrics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${metrics.partnerId}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">{error || 'No data available'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare chart data
  const funnelData = [
    { name: 'Views', value: metrics.totalViews, fill: '#8884d8' },
    { name: 'Clicks', value: metrics.totalClicks, fill: '#82ca9d' },
    { name: 'Applies', value: metrics.totalApplies, fill: '#ffc658' },
    { name: 'Hired', value: metrics.totalHired, fill: '#ff7c7c' },
  ];

  const conversionRateData = [
    {
      name: 'View → Click',
      rate: metrics.avgViewToClickRate,
      benchmark: 25 // Industry benchmark
    },
    {
      name: 'Click → Apply',
      rate: metrics.avgClickToApplyRate,
      benchmark: 20
    },
    {
      name: 'Apply → Hire',
      rate: metrics.avgApplyToHireRate,
      benchmark: 5
    },
  ];

  const topPerformingJobs = [...metrics.jobMetrics]
    .sort((a, b) => b.overallConversionRate - a.overallConversionRate)
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Job Analytics Dashboard</h1>
          <p className="text-gray-600">
            Hiring funnel metrics and conversion rates for {metrics.partnerName}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalViews.toLocaleString()}</div>
                <p className="text-xs text-gray-600">{metrics.totalJobs} active jobs</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Button Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalClicks.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {metrics.avgViewToClickRate.toFixed(1)}% CTR
                  </Badge>
                </div>
              </div>
              <MousePointer className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalApplies.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {metrics.avgClickToApplyRate.toFixed(1)}% conversion
                  </Badge>
                </div>
              </div>
              <FileText className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Hired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalHired.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {metrics.avgApplyToHireRate.toFixed(1)}% hire rate
                  </Badge>
                </div>
              </div>
              <UserCheck className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">Hiring Funnel</TabsTrigger>
          <TabsTrigger value="performance">Job Performance</TabsTrigger>
          <TabsTrigger value="conversion">Conversion Rates</TabsTrigger>
        </TabsList>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Application Funnel</CardTitle>
                <CardDescription>Views → Clicks → Applies → Hired</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Conversion Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates</CardTitle>
                <CardDescription>Your rates vs. industry benchmarks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={conversionRateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="rate" fill="#82ca9d" name="Your Rate" />
                    <Bar dataKey="benchmark" fill="#8884d8" name="Benchmark" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Overall Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {metrics.avgViewToClickRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">View to Click Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {metrics.avgViewToClickRate >= 25 ? '✓ Above benchmark' : '↓ Below benchmark (25%)'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {metrics.avgClickToApplyRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Click to Apply Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {metrics.avgClickToApplyRate >= 20 ? '✓ Above benchmark' : '↓ Below benchmark (20%)'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {metrics.avgApplyToHireRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Apply to Hire Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {metrics.avgApplyToHireRate >= 5 ? '✓ Above benchmark' : '↓ Below benchmark (5%)'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Jobs</CardTitle>
              <CardDescription>Jobs with highest conversion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformingJobs.map((job, index) => (
                  <div
                    key={job.jobId}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/org/jobs/${job.jobId}/analytics`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <h4 className="font-semibold">{job.jobTitle}</h4>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>{job.views} views</span>
                        <span>•</span>
                        <span>{job.applies} applies</span>
                        <span>•</span>
                        <span>{job.hired} hired</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {job.overallConversionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">conversion rate</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* All Jobs Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Job Title</th>
                      <th className="text-right p-2">Views</th>
                      <th className="text-right p-2">Clicks</th>
                      <th className="text-right p-2">Applies</th>
                      <th className="text-right p-2">Hired</th>
                      <th className="text-right p-2">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.jobMetrics.map((job) => (
                      <tr
                        key={job.jobId}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => window.location.href = `/org/jobs/${job.jobId}/analytics`}
                      >
                        <td className="p-2">{job.jobTitle}</td>
                        <td className="text-right p-2">{job.views}</td>
                        <td className="text-right p-2">{job.clicks}</td>
                        <td className="text-right p-2">{job.applies}</td>
                        <td className="text-right p-2">{job.hired}</td>
                        <td className="text-right p-2">
                          <Badge variant={job.overallConversionRate >= 1 ? 'default' : 'outline'}>
                            {job.overallConversionRate.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversion Tab */}
        <TabsContent value="conversion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate Analysis</CardTitle>
              <CardDescription>Step-by-step conversion breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Step 1: View to Click */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Step 1: Job View → Button Click</h4>
                    <Badge variant={metrics.avgViewToClickRate >= 25 ? 'default' : 'outline'}>
                      {metrics.avgViewToClickRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full"
                      style={{ width: `${Math.min(metrics.avgViewToClickRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {metrics.totalClicks} of {metrics.totalViews} viewers clicked "Apply with VitalCV"
                  </p>
                </div>

                {/* Step 2: Click to Apply */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Step 2: Button Click → Application Submit</h4>
                    <Badge variant={metrics.avgClickToApplyRate >= 20 ? 'default' : 'outline'}>
                      {metrics.avgClickToApplyRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full"
                      style={{ width: `${Math.min(metrics.avgClickToApplyRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {metrics.totalApplies} of {metrics.totalClicks} users completed application
                  </p>
                </div>

                {/* Step 3: Apply to Hire */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Step 3: Application → Hired</h4>
                    <Badge variant={metrics.avgApplyToHireRate >= 5 ? 'default' : 'outline'}>
                      {metrics.avgApplyToHireRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-yellow-500 h-4 rounded-full"
                      style={{ width: `${Math.min(metrics.avgApplyToHireRate * 10, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {metrics.totalHired} of {metrics.totalApplies} applicants were hired
                  </p>
                </div>

                {/* Overall Conversion */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">Overall: Job View → Hired</h4>
                    <Badge variant="default" className="text-lg">
                      {metrics.avgOverallConversionRate.toFixed(2)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {metrics.totalHired} of {metrics.totalViews} total viewers were ultimately hired
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Insights & Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.avgViewToClickRate < 25 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-yellow-900">Low Click-Through Rate</h5>
                      <p className="text-sm text-yellow-700">
                        Your view-to-click rate is below the 25% benchmark. Consider improving job titles,
                        descriptions, or button placement to increase engagement.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.avgClickToApplyRate < 20 && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                    <Activity className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-orange-900">High Drop-off During Application</h5>
                      <p className="text-sm text-orange-700">
                        Users are clicking but not completing applications. The Apply-with-VitalCV widget
                        may need optimization or there may be technical issues.
                      </p>
                    </div>
                  </div>
                )}

                {metrics.avgApplyToHireRate >= 5 && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-green-900">Strong Hire Rate</h5>
                      <p className="text-sm text-green-700">
                        Your application-to-hire rate is above the 5% benchmark. VitalCV's verified
                        credentials are helping you find quality candidates efficiently.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function generateCSVReport(metrics: PartnerMetrics): string {
  const header = 'Job Title,Views,Clicks,Applies,Hired,View-to-Click %,Click-to-Apply %,Apply-to-Hire %,Overall Conversion %\n';
  const rows = metrics.jobMetrics.map(job =>
    `"${job.jobTitle}",${job.views},${job.clicks},${job.applies},${job.hired},${job.viewToClickRate},${job.clickToApplyRate},${job.applyToHireRate},${job.overallConversionRate}`
  ).join('\n');

  const summary = `\n\nSummary\nTotal Jobs,${metrics.totalJobs}\nTotal Views,${metrics.totalViews}\nTotal Clicks,${metrics.totalClicks}\nTotal Applies,${metrics.totalApplies}\nTotal Hired,${metrics.totalHired}\nAvg View-to-Click %,${metrics.avgViewToClickRate}\nAvg Click-to-Apply %,${metrics.avgClickToApplyRate}\nAvg Apply-to-Hire %,${metrics.avgApplyToHireRate}\nAvg Overall Conversion %,${metrics.avgOverallConversionRate}`;

  return header + rows + summary;
}

