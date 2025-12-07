'use client';

/**
 * B121C-FE-022: FHIR pipeline tile (freshness, verification count)
 *
 * Renders freshness %; link to source evidence
 *
 * Acceptance Criteria:
 * - renders freshness %
 * - link to source evidence
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface FhirDashboardData {
  freshness: {
    percentage: number;
    totalRuns: number;
    freshRuns: number;
    staleRuns: number;
    windowDays: number;
  };
  verificationCount: number;
  recentRuns: Array<{
    id: string;
    npi: string | null;
    status: string;
    finishedAt: string | null;
    agentName: string;
    startedAt: string | null;
  }>;
  providerMetrics?: Array<{
    npi: string;
    freshness: number;
    totalRuns: number;
    freshRuns: number;
    lastRunAt: string | null;
  }>;
  timestamp: string;
}

function getFreshnessStatus(percentage: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (percentage >= 95) return 'excellent';
  if (percentage >= 85) return 'good';
  if (percentage >= 70) return 'fair';
  return 'poor';
}

function getFreshnessColor(status: 'excellent' | 'good' | 'fair' | 'poor') {
  switch (status) {
    case 'excellent':
      return {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-700',
        darkBg: 'dark:bg-green-950',
        darkBorder: 'dark:border-green-800',
        darkText: 'dark:text-green-300',
        badge: 'bg-green-100 text-green-800 border-green-300',
      };
    case 'good':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-700',
        darkBg: 'dark:bg-blue-950',
        darkBorder: 'dark:border-blue-800',
        darkText: 'dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-800 border-blue-300',
      };
    case 'fair':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
        text: 'text-yellow-700',
        darkBg: 'dark:bg-yellow-950',
        darkBorder: 'dark:border-yellow-800',
        darkText: 'dark:text-yellow-300',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      };
    case 'poor':
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-700',
        darkBg: 'dark:bg-red-950',
        darkBorder: 'dark:border-red-800',
        darkText: 'dark:text-red-300',
        badge: 'bg-red-100 text-red-800 border-red-300',
      };
  }
}

function getFreshnessIcon(status: 'excellent' | 'good' | 'fair' | 'poor') {
  switch (status) {
    case 'excellent':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'good':
      return <CheckCircle2 className="h-5 w-5 text-blue-600" />;
    case 'fair':
      return <Clock className="h-5 w-5 text-yellow-600" />;
    case 'poor':
      return <XCircle className="h-5 w-5 text-red-600" />;
  }
}

export default function FhirPipelinePage() {
  const [data, setData] = useState<FhirDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4004';

      // For now, we'll call without OIDC4VP auth (in production, include VP token)
      // TODO: Add OIDC4VP token to request headers
      const response = await fetch(`${backendUrl}/compliance/fhir/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
          // In production: 'Authorization': `Bearer ${vpToken}`
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please provide OIDC4VP presentation token.');
        }
        throw new Error(`Failed to fetch FHIR dashboard: ${response.statusText}`);
      }

      const apiData = await response.json();
      setData(apiData);
    } catch (err) {
      console.error('Failed to fetch FHIR dashboard:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error Loading FHIR Dashboard</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-gray-500">No data available</div>
      </div>
    );
  }

  const freshnessStatus = getFreshnessStatus(data.freshness.percentage);
  const colors = getFreshnessColor(freshnessStatus);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FHIR Pipeline Compliance</h1>
          <p className="text-muted-foreground mt-2">
            Monitor FHIR pipeline freshness and verification counts
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Freshness Tile */}
      <Card className={cn('transition-all hover:shadow-md', colors.bg, colors.border, colors.darkBg, colors.darkBorder)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={cn('text-lg font-semibold', colors.text, colors.darkText)}>
              Pipeline Freshness
            </CardTitle>
            {getFreshnessIcon(freshnessStatus)}
          </div>
          <CardDescription className={cn('text-sm', colors.darkText)}>
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className={cn('text-4xl font-bold', colors.text, colors.darkText)}>
                {data.freshness.percentage.toFixed(1)}%
              </span>
              <span className={cn('text-sm', colors.text, colors.darkText)}>
                fresh within {data.freshness.windowDays} days
              </span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={cn(
                  'h-3 rounded-full transition-all',
                  freshnessStatus === 'excellent' && 'bg-green-500',
                  freshnessStatus === 'good' && 'bg-blue-500',
                  freshnessStatus === 'fair' && 'bg-yellow-500',
                  freshnessStatus === 'poor' && 'bg-red-500'
                )}
                style={{ width: `${data.freshness.percentage}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className={cn('text-2xl font-bold', colors.text, colors.darkText)}>
                  {data.freshness.freshRuns}
                </div>
                <div className={cn('text-xs', colors.text, colors.darkText)}>
                  Fresh Runs
                </div>
              </div>
              <div>
                <div className={cn('text-2xl font-bold', colors.text, colors.darkText)}>
                  {data.freshness.staleRuns}
                </div>
                <div className={cn('text-xs', colors.text, colors.darkText)}>
                  Stale Runs
                </div>
              </div>
              <div>
                <div className={cn('text-2xl font-bold', colors.text, colors.darkText)}>
                  {data.freshness.totalRuns}
                </div>
                <div className={cn('text-xs', colors.text, colors.darkText)}>
                  Total Runs
                </div>
              </div>
            </div>

            <Badge className={cn('text-xs', colors.badge)}>
              {freshnessStatus.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Verification Count Tile */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Count</CardTitle>
          <CardDescription>
            Total successful FHIR pipeline verifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{data.verificationCount}</span>
            <span className="text-sm text-muted-foreground">successful verifications</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Pipeline Runs</CardTitle>
          <CardDescription>
            Latest FHIR pipeline agent executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentRuns.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>NPI</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Finished At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.agentName}</TableCell>
                      <TableCell>{run.npi || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === 'ok'
                              ? 'default'
                              : run.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {run.finishedAt
                          ? new Date(run.finishedAt).toLocaleString()
                          : 'In Progress'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/api/agents/runs/${run.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Evidence
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent runs found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Metrics */}
      {data.providerMetrics && data.providerMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider-Level Metrics</CardTitle>
            <CardDescription>
              Freshness metrics by provider (top 50)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NPI</TableHead>
                    <TableHead>Freshness</TableHead>
                    <TableHead>Total Runs</TableHead>
                    <TableHead>Fresh Runs</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.providerMetrics.map((provider) => {
                    const providerStatus = getFreshnessStatus(provider.freshness);
                    const providerColors = getFreshnessColor(providerStatus);
                    return (
                      <TableRow key={provider.npi}>
                        <TableCell className="font-medium">{provider.npi}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', providerColors.badge)}>
                            {provider.freshness.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{provider.totalRuns}</TableCell>
                        <TableCell>{provider.freshRuns}</TableCell>
                        <TableCell>
                          {provider.lastRunAt
                            ? new Date(provider.lastRunAt).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/compliance/fhir/${provider.npi}`}
                          >
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

