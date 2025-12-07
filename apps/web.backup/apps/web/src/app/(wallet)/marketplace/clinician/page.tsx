'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Clock,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

interface FacilityResult {
  facilityId: string;
  facilityName: string;
  matchScore?: {
    overall: number;
    breakdown: {
      credentials: number;
      trustTrajectory: number;
      skillCompetency: number;
      privilegingReadiness: number;
      telemedicineCoverage: number;
      compactPortability: number;
    };
    factors: {
      strengths: string[];
      gaps: string[];
    };
  };
  qualityScore: number;
  privilegingTimeline: {
    typical: number;
    fastTrack: number;
  };
  onboardingComplexity: 'simple' | 'moderate' | 'complex';
  rolesNeeded: Array<{
    role: string;
    specialty: string;
    priority: 'high' | 'medium' | 'low';
    shiftNeeds: number;
  }>;
}

export default function ClinicianMarketplacePage() {
  const { toast } = useToast();
  const [results, setResults] = useState<FacilityResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadResults();
  }, []);

  async function loadResults() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        clinicianId: 'demo-clinician',
        limit: '50',
      });

      const response = await fetch(`${API_BASE}/api/marketplace/clinician/browse?${params}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('[marketplace][clinician] load failed', err);
      toast({
        title: 'Unable to load facilities',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function requestPassport(facilityId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/marketplace/clinician/request-passport`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          facilityId,
          clinicianId: 'demo-clinician',
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = await response.json();
      toast({
        title: 'Passport request sent',
        description: `Facility ${facilityId} has requested your passport.`,
      });
    } catch (err) {
      console.error('[marketplace][clinician] passport request failed', err);
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clinician Marketplace</h1>
            <p className="text-muted-foreground">
              Discover facilities and view match score breakdowns
            </p>
          </div>
          <Button onClick={() => loadResults()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : results.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No facilities found</p>
            </CardContent>
          </Card>
        ) : (
          results.map((facility) => (
            <FacilityCard
              key={facility.facilityId}
              facility={facility}
              onRequestPassport={() => requestPassport(facility.facilityId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FacilityCard({
  facility,
  onRequestPassport,
}: {
  facility: FacilityResult;
  onRequestPassport: () => void;
}) {
  const matchScore = facility.matchScore?.overall ?? 0;
  const isFastTrack = matchScore >= 0.85 && facility.privilegingTimeline.fastTrack <= 14;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {facility.facilityName}
            </CardTitle>
            <CardDescription className="mt-1">
              {facility.rolesNeeded.map((r) => r.specialty).join(', ')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Match Score */}
        {facility.matchScore && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Match Score</span>
              <span className="font-semibold">
                {(matchScore * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={matchScore * 100} className="mt-1 h-2" />
          </div>
        )}

        {/* Quality Score */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" />
            Quality Score
          </span>
          <span className="font-semibold">
            {(facility.qualityScore * 100).toFixed(1)}%
          </span>
        </div>

        {/* Privileging Timeline */}
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Privileging
            </span>
            <span className="font-semibold">
              {facility.privilegingTimeline.typical} days
            </span>
          </div>
          {isFastTrack && (
            <Badge variant="secondary" className="text-xs">
              Fast Track: {facility.privilegingTimeline.fastTrack} days
            </Badge>
          )}
        </div>

        {/* Onboarding Complexity */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Onboarding</span>
          <Badge
            variant={
              facility.onboardingComplexity === 'simple'
                ? 'default'
                : facility.onboardingComplexity === 'moderate'
                ? 'secondary'
                : 'outline'
            }
          >
            {facility.onboardingComplexity}
          </Badge>
        </div>

        {/* Match Score Breakdown */}
        {facility.matchScore && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Match breakdown
            </summary>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Credentials:</span>
                <span>
                  {(facility.matchScore.breakdown.credentials * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Trust Trajectory:</span>
                <span>
                  {(facility.matchScore.breakdown.trustTrajectory * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Skills:</span>
                <span>
                  {(facility.matchScore.breakdown.skillCompetency * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Privileging:</span>
                <span>
                  {(facility.matchScore.breakdown.privilegingReadiness * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {facility.matchScore.factors.strengths.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-emerald-600">Strengths:</p>
                <ul className="list-disc pl-4">
                  {facility.matchScore.factors.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {facility.matchScore.factors.gaps.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-amber-600">Gaps:</p>
                <ul className="list-disc pl-4">
                  {facility.matchScore.factors.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onRequestPassport}
          >
            <FileText className="mr-2 h-4 w-4" />
            Request Passport
          </Button>
          {isFastTrack && (
            <Badge className="bg-emerald-500">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Fast Track
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

