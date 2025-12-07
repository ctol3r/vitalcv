/**
 * Career Growth Dashboard
 * Task 9: Create CareerGrowthDashboardView
 * Phase 2: Career Dashboard (8 tasks)
 */

'use client';

import { useMemo } from 'react';
import { TrendingUp, Shield, Clock, Award, Target, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useGrowthEngine } from '@/lib/growth/view-model';
import { CareerStageDetector } from '@/lib/growth/intelligence';
import { CareerStageBanner } from './CareerStageBanner';
import { NextRolesPrediction } from './NextRolesPrediction';
import { IdentityHealthMeter } from './IdentityHealthMeter';
import { LicenseExpirationCountdown } from './LicenseExpirationCountdown';
import { CertificationAge } from './CertificationAge';
import { ExperienceGapsSummary } from './ExperienceGapsSummary';
import { CareerProgressSparkline } from './CareerProgressSparkline';

interface CareerGrowthDashboardProps {
  clinicianId: string | null;
}

export function CareerGrowthDashboard({ clinicianId }: CareerGrowthDashboardProps) {
  const {
    profile,
    careerStage,
    roleTrajectory,
    identityHealth,
    renewalPredictions,
    experienceGaps,
    trustHistory,
    loading,
    error,
  } = useGrowthEngine(clinicianId);

  const stageLabel = useMemo(() => {
    if (!careerStage) return null;
    return CareerStageDetector.getStageLabel(careerStage);
  }, [careerStage]);

  const stageColor = useMemo(() => {
    if (!careerStage) return '';
    return CareerStageDetector.getStageColor(careerStage);
  }, [careerStage]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Error Loading Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No profile data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Task 10: Career Stage Banner with Animation */}
      {careerStage && stageLabel && (
        <CareerStageBanner stage={careerStage} label={stageLabel} color={stageColor} />
      )}

      {/* Task 11: Next Possible Roles Prediction Chips */}
      {roleTrajectory && roleTrajectory.nextPossibleRoles.length > 0 && (
        <NextRolesPrediction roles={roleTrajectory.nextPossibleRoles} />
      )}

      {/* Task 12: Identity Health Meter */}
      {identityHealth && <IdentityHealthMeter health={identityHealth} />}

      {/* Task 13: License Expiration Countdown + Renewal CTA */}
      {renewalPredictions.length > 0 && (
        <LicenseExpirationCountdown predictions={renewalPredictions} />
      )}

      {/* Task 14: Certification Age with Predicted Re-certification Needs */}
      {profile.credentials.length > 0 && (
        <CertificationAge credentials={profile.credentials} />
      )}

      {/* Task 15: Experience Gaps Summary */}
      {experienceGaps.length > 0 && <ExperienceGapsSummary gaps={experienceGaps} />}

      {/* Task 16: Career Progress Sparkline */}
      {trustHistory.length > 0 && (
        <CareerProgressSparkline history={trustHistory} currentScore={profile.trustScore} />
      )}

      {/* Additional Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trust Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(profile.trustScore * 100).toFixed(0)}%</div>
            <Progress value={profile.trustScore * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Years Practicing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.yearsPracticing}</div>
            <p className="text-xs text-muted-foreground mt-1">Experience</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Credentials</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {profile.credentials.filter((c) => {
                if (!c.expiresAt) return true;
                return new Date(c.expiresAt) > new Date();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valid credentials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match History</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.matchHistory.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total matches</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

