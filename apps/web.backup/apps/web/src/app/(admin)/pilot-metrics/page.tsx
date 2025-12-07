'use client';

/**
 * METRIC-012: Pilot Metrics Overview Page
 *
 * Displays core KPIs for credentialing lifecycle:
 * - Time-to-credential (median, mean, p95)
 * - Verification events (success rate, failure reasons)
 * - Application funnel (sourced → applied → verified → hired)
 * - Exportable as CSV for grant reporting
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Users } from 'lucide-react';

interface TimeToCredentialStats {
  median: number | null;
  mean: number | null;
  p95: number | null;
  total: number;
  completed: number;
  inProgress: number;
}

interface VerificationEventStats {
  total: number;
  verified: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  failureRate: number;
}

interface ApplicationFunnelStats {
  sourced: number;
  applied: number;
  verified: number;
  hired: number;
  conversionRates: {
    sourcedToApplied: number;
    appliedToVerified: number;
    verifiedToHired: number;
    overall: number;
  };
}

interface DashboardData {
  timeToCredential: TimeToCredentialStats;
  verificationEvents: VerificationEventStats;
  applicationFunnel: ApplicationFunnelStats;
  computedAt: string;
}

export default function PilotMetricsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      const response = await fetch(`${baseUrl}/api/metrics/dashboard?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const metricsData = await response.json();
      setData(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const exportToCSV = async () => {
    if (!data) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const params = new URLSearchParams({
      startDate: dateRange.start,
      endDate: dateRange.end,
      format: 'csv',
    });

    try {
      const response = await fetch(`${baseUrl}/api/metrics/export/dashboard?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitalcv-metrics-${dateRange.start}-${dateRange.end}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export CSV');
    }
  };

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchMetrics} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pilot Metrics Overview</h1>
          <p className="text-gray-600 mt-1">Core KPIs for credentialing lifecycle and ROI analysis</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Start:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">End:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Time to Credential Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time to Credential
          </CardTitle>
          <CardDescription>
            Median time from application submission to completed credential packet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Median Days</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">
                {data.timeToCredential.median !== null
                  ? `${data.timeToCredential.median.toFixed(1)}`
                  : 'N/A'}
              </div>
              {data.timeToCredential.median !== null && data.timeToCredential.median < 60 && (
                <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
                  <TrendingDown className="h-4 w-4" />
                  On target
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Mean Days</div>
              <div className="text-3xl font-bold text-gray-700 mt-1">
                {data.timeToCredential.mean !== null
                  ? `${data.timeToCredential.mean.toFixed(1)}`
                  : 'N/A'}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">95th Percentile</div>
              <div className="text-3xl font-bold text-purple-600 mt-1">
                {data.timeToCredential.p95 !== null
                  ? `${data.timeToCredential.p95.toFixed(1)}`
                  : 'N/A'}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Completion Rate</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {data.timeToCredential.total > 0
                  ? `${(
                      (data.timeToCredential.completed / data.timeToCredential.total) *
                      100
                    ).toFixed(1)}%`
                  : '0%'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.timeToCredential.completed} / {data.timeToCredential.total} completed
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Events Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Verification Events
          </CardTitle>
          <CardDescription>Credential verification outcomes and failure analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Verified</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {data.verificationEvents.verified}
              </div>
              <div className="text-xs text-gray-500 mt-1">Success count</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Failed</div>
              <div className="text-3xl font-bold text-red-600 mt-1">
                {data.verificationEvents.failed}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.verificationEvents.failureRate.toFixed(1)}% failure rate
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Pending</div>
              <div className="text-3xl font-bold text-yellow-600 mt-1">
                {data.verificationEvents.pending}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">
                {data.verificationEvents.total}
              </div>
            </div>
          </div>

          {/* Verification by Type */}
          {Object.keys(data.verificationEvents.byType).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">By Verification Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(data.verificationEvents.byType).map(([type, count]) => (
                  <div key={type} className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">{type}</div>
                    <div className="text-lg font-semibold text-gray-800">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Funnel Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Application Funnel
          </CardTitle>
          <CardDescription>Conversion rates through credentialing stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Funnel Visualization */}
            <div className="space-y-2">
              {[
                { label: 'Sourced', count: data.applicationFunnel.sourced, color: 'bg-blue-500' },
                { label: 'Applied', count: data.applicationFunnel.applied, color: 'bg-purple-500' },
                { label: 'Verified', count: data.applicationFunnel.verified, color: 'bg-green-500' },
                { label: 'Hired', count: data.applicationFunnel.hired, color: 'bg-emerald-500' },
              ].map((stage, index) => {
                const maxCount = Math.max(
                  data.applicationFunnel.sourced,
                  data.applicationFunnel.applied,
                  data.applicationFunnel.verified,
                  data.applicationFunnel.hired,
                  1
                );
                const widthPercent = (stage.count / maxCount) * 100;

                return (
                  <div key={stage.label} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                      <span className="text-sm text-gray-600">{stage.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div
                        className={`${stage.color} h-full text-white flex items-center justify-end pr-2 text-sm font-medium transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      >
                        {stage.count > 0 && stage.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conversion Rates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">Sourced → Applied</div>
                <div className="text-xl font-bold text-gray-800 mt-1">
                  {data.applicationFunnel.conversionRates.sourcedToApplied.toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">Applied → Verified</div>
                <div className="text-xl font-bold text-gray-800 mt-1">
                  {data.applicationFunnel.conversionRates.appliedToVerified.toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-600">Verified → Hired</div>
                <div className="text-xl font-bold text-gray-800 mt-1">
                  {data.applicationFunnel.conversionRates.verifiedToHired.toFixed(1)}%
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded border-2 border-blue-200">
                <div className="text-xs text-gray-600">Overall Conversion</div>
                <div className="text-xl font-bold text-blue-600 mt-1">
                  {data.applicationFunnel.conversionRates.overall.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {data.computedAt ? new Date(data.computedAt).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
}

