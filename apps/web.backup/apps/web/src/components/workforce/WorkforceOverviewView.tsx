/**
 * Workforce Overview View Component
 * Phase 1: Task 3 - Workforce Overview Dashboard
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type {
  WorkforceOverview,
  CredentialProportions,
  SpecialtyDistribution,
  RoleCoverage,
} from '@/lib/workforce/models';
import { Users, ShieldCheck, TrendingUp, Clock } from 'lucide-react';
import { SpecialtyDistributionChart } from './SpecialtyDistributionChart';
import { RoleCoverageBar } from './RoleCoverageBar';

interface WorkforceOverviewViewProps {
  overview: WorkforceOverview;
  credentialProportions: CredentialProportions;
  specialtyDistribution: SpecialtyDistribution[];
  roleCoverage: RoleCoverage[];
}

export function WorkforceOverviewView({
  overview,
  credentialProportions,
  specialtyDistribution,
  roleCoverage,
}: WorkforceOverviewViewProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Clinicians</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalActiveClinicians.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.credentialedCount} credentialed • {overview.verifiedCount} verified •{' '}
              {overview.anchoredCount} anchored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Health Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(overview.complianceHealthScore * 100).toFixed(1)}%
            </div>
            <Progress value={overview.complianceHealthScore * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {overview.complianceHealthScore >= 0.9
                ? 'Excellent'
                : overview.complianceHealthScore >= 0.7
                  ? 'Good'
                  : 'Needs Attention'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Trust Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.averageTrustScore.toFixed(2)}</div>
            <Progress value={overview.averageTrustScore * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Trust-weighted workforce readiness</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anchor Freshness Index</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.anchorFreshnessIndex.toFixed(1)}</div>
            <Progress value={overview.anchorFreshnessIndex * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {overview.anchorFreshnessIndex >= 0.8
                ? 'Fresh'
                : overview.anchorFreshnessIndex >= 0.5
                  ? 'Stale'
                  : 'Critical'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credential Proportions */}
      <Card>
        <CardHeader>
          <CardTitle>Credential Status Proportions</CardTitle>
          <CardDescription>
            Credentialed → Verified → Anchored progression across workforce
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Credentialed</span>
                <span className="font-medium">{credentialProportions.credentialed.toFixed(1)}%</span>
              </div>
              <Progress value={credentialProportions.credentialed} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Verified</span>
                <span className="font-medium">{credentialProportions.verified.toFixed(1)}%</span>
              </div>
              <Progress value={credentialProportions.verified} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Anchored</span>
                <span className="font-medium">{credentialProportions.anchored.toFixed(1)}%</span>
              </div>
              <Progress value={credentialProportions.anchored} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specialty Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Specialty Distribution</CardTitle>
          <CardDescription>Workforce distribution across medical specialties</CardDescription>
        </CardHeader>
        <CardContent>
          <SpecialtyDistributionChart data={specialtyDistribution} />
        </CardContent>
      </Card>

      {/* Role Coverage Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Role Coverage</CardTitle>
          <CardDescription>RN/MD/PA/CRNA/PT/Specialists coverage and readiness</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleCoverageBar data={roleCoverage} />
        </CardContent>
      </Card>
    </div>
  );
}








