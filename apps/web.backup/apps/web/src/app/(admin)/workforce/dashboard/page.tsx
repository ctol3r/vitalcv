/**
 * Workforce Command Center - Dashboard Page
 * Phase 1: Workforce Overview Dashboard
 */

'use client';

import { useWorkforceDashboard } from '@/lib/workforce/view-model';
import { WorkforceOverviewView } from '@/components/workforce/WorkforceOverviewView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function WorkforceDashboardPage() {
  const {
    state,
    data,
    error,
    lastRefreshed,
    isLoading,
    isReady,
    hasError,
    overview,
    credentialProportions,
    specialtyDistribution,
    roleCoverage,
    refresh,
  } = useWorkforceDashboard();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Command Center</h1>
          <p className="text-muted-foreground mt-1">
            Real-time workforce intelligence and operational readiness
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {lastRefreshed && (
        <p className="text-sm text-muted-foreground">
          Last updated: {new Date(lastRefreshed).toLocaleString()}
        </p>
      )}

      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      )}

      {isReady && data && (
        <WorkforceOverviewView
          overview={overview!}
          credentialProportions={credentialProportions!}
          specialtyDistribution={specialtyDistribution}
          roleCoverage={roleCoverage}
        />
      )}
    </div>
  );
}








