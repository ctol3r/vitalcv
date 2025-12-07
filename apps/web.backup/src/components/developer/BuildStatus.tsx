/**
 * BuildStatus Dashboard
 *
 * Displays CI pipeline status for each module: queued, running, passed, failed.
 * Links to logs and test reports. Auto-refreshes.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export type BuildStatusType = 'queued' | 'running' | 'passed' | 'failed';

interface BuildStatusProps {
  moduleId: string;
  status: BuildStatusType;
  compact?: boolean;
}

interface BuildDetails {
  status: BuildStatusType;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  logsUrl?: string;
  testReportUrl?: string;
  error?: string;
  steps?: BuildStep[];
}

interface BuildStep {
  name: string;
  status: BuildStatusType;
  duration?: number;
  logs?: string;
}

export default function BuildStatus({ moduleId, status, compact = false }: BuildStatusProps) {
  const [details, setDetails] = useState<BuildDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(status === 'queued' || status === 'running');

  useEffect(() => {
    fetchBuildDetails();
  }, [moduleId]);

  useEffect(() => {
    if (autoRefresh && (status === 'queued' || status === 'running')) {
      const interval = setInterval(() => {
        fetchBuildDetails();
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, status]);

  async function fetchBuildDetails() {
    try {
      const res = await fetch(`/api/demo/developer/modules/${moduleId}/build`);
      if (!res.ok) throw new Error('Failed to fetch build details');
      const data = await res.json();
      setDetails(data);
      setLoading(false);

      // Stop auto-refresh if build is complete
      if (data.status === 'passed' || data.status === 'failed') {
        setAutoRefresh(false);
      }
    } catch (err) {
      console.error('Failed to fetch build details:', err);
      setLoading(false);
    }
  }

  function getStatusBadge(status: BuildStatusType) {
    const variants: Record<BuildStatusType, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      queued: 'outline',
      running: 'secondary',
      passed: 'default',
      failed: 'destructive',
    };

    const labels: Record<BuildStatusType, string> = {
      queued: 'Queued',
      running: 'Running',
      passed: 'Passed',
      failed: 'Failed',
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getStatusBadge(status)}
        {autoRefresh && (
          <span className="text-xs text-muted-foreground animate-pulse">•</span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">Loading build status...</div>
        </CardContent>
      </Card>
    );
  }

  const buildDetails = details || {
    status,
    steps: [],
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Build Status</CardTitle>
            <CardDescription>
              CI pipeline execution status
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(buildDetails.status)}
            {autoRefresh && (
              <Badge variant="outline" className="animate-pulse">
                Auto-refreshing
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Build Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {buildDetails.startedAt && (
            <div>
              <span className="text-muted-foreground">Started:</span>{' '}
              <span className="font-medium">
                {new Date(buildDetails.startedAt).toLocaleString()}
              </span>
            </div>
          )}
          {buildDetails.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed:</span>{' '}
              <span className="font-medium">
                {new Date(buildDetails.completedAt).toLocaleString()}
              </span>
            </div>
          )}
          {buildDetails.duration !== undefined && (
            <div>
              <span className="text-muted-foreground">Duration:</span>{' '}
              <span className="font-medium">
                {formatDuration(buildDetails.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {buildDetails.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <div className="text-sm font-medium text-destructive mb-1">Build Error</div>
            <div className="text-sm text-muted-foreground">{buildDetails.error}</div>
          </div>
        )}

        {/* Build Steps */}
        {buildDetails.steps && buildDetails.steps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Build Steps</h4>
            <div className="space-y-2">
              {buildDetails.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {getStatusBadge(step.status)}
                    <span className="text-sm">{step.name}</span>
                  </div>
                  {step.duration !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(step.duration)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {buildDetails.logsUrl && (
            <Link href={buildDetails.logsUrl} target="_blank">
              <Button variant="outline" size="sm">
                View Logs
              </Button>
            </Link>
          )}
          {buildDetails.testReportUrl && (
            <Link href={buildDetails.testReportUrl} target="_blank">
              <Button variant="outline" size="sm">
                Test Report
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              if (!autoRefresh) {
                fetchBuildDetails();
              }
            }}
          >
            {autoRefresh ? 'Stop Auto-refresh' : 'Refresh'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

