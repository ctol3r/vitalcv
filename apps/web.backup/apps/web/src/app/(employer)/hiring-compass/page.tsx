'use client';

import { Compass, TrendingUp, Target, Users, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface StrategicRole {
  role: string;
  impact: number;
  priority: number;
  urgency: number;
}

interface HiringCompass {
  roles: StrategicRole[];
  roi: {
    roi: number;
    timeToValue: number;
    totalValue: number;
  };
  gaps: {
    staffingGaps: Array<{ role: string; shortage: number; impact: number }>;
    competencyGaps: Array<{ area: string; gap: number; priority: number }>;
  };
  recommendations: Array<{
    clinicianId: string;
    matchScore: number;
    rationale: string;
  }>;
}

export default function HiringCompassPage() {
  const [compass, setCompass] = useState<HiringCompass | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompass();
  }, []);

  async function fetchCompass() {
    try {
      // Get orgId from session or use a default for demo
      const orgId = 'demo-org-id'; // TODO: Get from auth context
      const res = await fetch(`${API_BASE}/api/hiring-compass/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        // Fetch additional data
        const [rolesRes, gapsRes, roiRes] = await Promise.all([
          fetch(`${API_BASE}/api/hiring-compass/forecast-roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId }),
          }),
          fetch(`${API_BASE}/api/hiring-compass/gaps/${orgId}`),
          fetch(`${API_BASE}/api/hiring-compass/estimate-roi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, role: 'physician', candidateType: 'experienced' }),
          }),
        ]);

        const roles = rolesRes.ok ? await rolesRes.json() : { roles: [] };
        const gaps = gapsRes.ok ? await gapsRes.json() : { staffingGaps: [], competencyGaps: [] };
        const roi = roiRes.ok ? await roiRes.json() : { roi: 0, timeToValue: 0, totalValue: 0 };

        setCompass({
          ...data,
          roles: roles.roles || [],
          gaps: { ...gaps },
          roi: { ...roi },
          recommendations: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch hiring compass:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!compass) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Hiring Compass</CardTitle>
            <CardDescription>No compass data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Compass className="h-8 w-8" />
          Strategic Hiring Compass
        </h1>
        <p className="text-muted-foreground mt-2">
          An AI compass showing employers where, how, and who to hire for maximum impact
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              ROI Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{Math.round(compass.roi.roi * 100)}%</div>
              <div className="text-sm text-muted-foreground">
                Time to value: {compass.roi.timeToValue} months
              </div>
              <div className="text-sm text-muted-foreground">
                Total value: ${compass.roi.totalValue.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compass.gaps.staffingGaps.length}</div>
            <div className="text-sm text-muted-foreground">Active gaps detected</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Competency Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compass.gaps.competencyGaps.length}</div>
            <div className="text-sm text-muted-foreground">Areas needing improvement</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strategic Roles</CardTitle>
          <CardDescription>Roles delivering highest impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {compass.roles.map((role, i) => {
              const score = (role.impact * 0.4) + (role.priority * 0.4) + (role.urgency * 0.2);
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{role.role}</span>
                    <Badge variant={score >= 0.7 ? 'default' : 'secondary'}>
                      Score: {Math.round(score * 100)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Impact: </span>
                      <span className="font-medium">{Math.round(role.impact * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priority: </span>
                      <span className="font-medium">{Math.round(role.priority * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Urgency: </span>
                      <span className="font-medium">{Math.round(role.urgency * 100)}%</span>
                    </div>
                  </div>
                  <Progress value={score * 100} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {compass.gaps.staffingGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staffing Gaps</CardTitle>
            <CardDescription>Identified competency or staffing gaps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {compass.gaps.staffingGaps.map((gap, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <span className="font-medium">{gap.role}</span>
                    <div className="text-sm text-muted-foreground">
                      Shortage: {gap.shortage} positions
                    </div>
                  </div>
                  <Badge variant={gap.impact > 0.7 ? 'destructive' : 'secondary'}>
                    Impact: {Math.round(gap.impact * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {compass.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Strategic Match Recommendations</CardTitle>
            <CardDescription>Top matches for strategic initiatives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {compass.recommendations.map((rec, i) => (
                <div key={i} className="p-3 border rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Clinician {rec.clinicianId.slice(0, 8)}</span>
                    <Badge variant={rec.matchScore >= 0.8 ? 'default' : 'secondary'}>
                      Match: {Math.round(rec.matchScore * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

