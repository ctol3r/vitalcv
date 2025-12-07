'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminAnalyticsApi } from '@/lib/admin/api';
import { PlatformAnalytics, ComplianceMetrics } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  Users,
  Shield,
  Building2,
  TrendingUp,
  AlertCircle,
  Download,
  Calendar,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminAnalyticsPage() {
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [platform, compliance] = await Promise.all([
        adminAnalyticsApi.getPlatformAnalytics(),
        adminAnalyticsApi.getComplianceMetrics(),
      ]);
      setPlatformAnalytics(platform);
      setComplianceMetrics(compliance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateNCQAReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      const blob = await adminAnalyticsApi.generateNCQAReport(reportStartDate, reportEndDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ncqa-report-${reportStartDate}-${reportEndDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate NCQA report');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        <p className="text-muted-foreground">
          Platform metrics, compliance dashboards, and exportable reports
        </p>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Platform Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Platform Analytics
          </CardTitle>
          <CardDescription>Key metrics and trends</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64" />
          ) : platformAnalytics ? (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{platformAnalytics.dailyActiveUsers.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Daily Active Users</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{platformAnalytics.verificationsPerDay.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Verifications/Day</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">
                    {(platformAnalytics.credentialAcceptanceRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Acceptance Rate</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{platformAnalytics.facilitiesOnboarded.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Facilities</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{platformAnalytics.matchScoreConversions.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Match Conversions</div>
                </div>
              </div>

              {/* Trends Chart */}
              {platformAnalytics.trends.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-4">Trends (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={platformAnalytics.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="users" stroke="#8884d8" name="Users" />
                      <Line type="monotone" dataKey="verifications" stroke="#82ca9d" name="Verifications" />
                      <Line type="monotone" dataKey="credentials" stroke="#ffc658" name="Credentials" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Compliance Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Dashboard
          </CardTitle>
          <CardDescription>
            DEA, license, and CME expiration tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64" />
          ) : complianceMetrics ? (
            <div className="space-y-6">
              {/* DEA Expirations */}
              <div>
                <h3 className="text-sm font-semibold mb-3">DEA Expirations</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg border-yellow-500">
                    <div className="text-2xl font-bold text-yellow-600">
                      {complianceMetrics.deaExpirations.expiring30Days}
                    </div>
                    <div className="text-sm text-muted-foreground">Expiring in 30 Days</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg border-orange-500">
                    <div className="text-2xl font-bold text-orange-600">
                      {complianceMetrics.deaExpirations.expiring60Days}
                    </div>
                    <div className="text-sm text-muted-foreground">Expiring in 60 Days</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg border-red-500">
                    <div className="text-2xl font-bold text-red-600">
                      {complianceMetrics.deaExpirations.expired}
                    </div>
                    <div className="text-sm text-muted-foreground">Expired</div>
                  </div>
                </div>
              </div>

              {/* License Expirations */}
              <div>
                <h3 className="text-sm font-semibold mb-3">License Expirations</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg border-yellow-500">
                    <div className="text-2xl font-bold text-yellow-600">
                      {complianceMetrics.licenseExpirations.expiring30Days}
                    </div>
                    <div className="text-sm text-muted-foreground">Expiring in 30 Days</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg border-orange-500">
                    <div className="text-2xl font-bold text-orange-600">
                      {complianceMetrics.licenseExpirations.expiring60Days}
                    </div>
                    <div className="text-sm text-muted-foreground">Expiring in 60 Days</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg border-red-500">
                    <div className="text-2xl font-bold text-red-600">
                      {complianceMetrics.licenseExpirations.expired}
                    </div>
                    <div className="text-sm text-muted-foreground">Expired</div>
                  </div>
                </div>
              </div>

              {/* CME Deficits */}
              <div>
                <h3 className="text-sm font-semibold mb-3">CME Deficits</h3>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {complianceMetrics.cmeDeficits.total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Deficits</div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Report Generation
          </CardTitle>
          <CardDescription>
            Generate NCQA-ready verification reports and TrustState exports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">NCQA Verification Report</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleGenerateNCQAReport} className="mt-4" disabled={!reportStartDate || !reportEndDate}>
              <Download className="h-4 w-4 mr-2" />
              Generate NCQA Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

