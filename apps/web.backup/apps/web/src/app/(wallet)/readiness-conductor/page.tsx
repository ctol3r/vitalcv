'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface ReadinessConductorData {
  dimensions: {
    credential: number;
    privilege: number;
    safety: number;
    cme: number;
    sanctions: number;
  };
  overallScore: number;
  harmonized: boolean;
  deteriorationDetected: boolean;
  trajectory: Array<{ days: number; predictedScore: number }>;
  interventions: Array<{ action: string; priority: number }>;
  alignment: {
    jobRequirements: string[];
    gaps: string[];
    matchScore: number;
  };
}

export default function ReadinessConductorPage() {
  const [data, setData] = useState<ReadinessConductorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/readiness-conductor/${clinicianId}`);
      if (res.ok) {
        const conductor = await res.json();
        setData(conductor);
      }
    } catch (error) {
      console.error('Failed to load readiness conductor:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Readiness Conductor</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Global Clinician Readiness Conductor</h1>
            <p className="text-muted-foreground">
              Orchestrate readiness across credentials, privileges, safety, performance & regulatory status
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall Readiness Score</CardTitle>
              <CardDescription>Multi-dimensional readiness assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold">{data.overallScore}%</span>
                  <Badge variant={data.overallScore > 80 ? 'default' : 'secondary'}>
                    {data.overallScore > 80 ? 'Ready' : data.overallScore > 60 ? 'Marginal' : 'Not Ready'}
                  </Badge>
                  {data.deteriorationDetected && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Deterioration Detected
                    </Badge>
                  )}
                </div>
                <Progress value={data.overallScore} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {Object.entries(data.dimensions).map(([key, value]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-semibold">{value}%</div>
                    <Progress value={value} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.interventions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Intervention Suggestions</CardTitle>
                <CardDescription>Recommended actions to increase readiness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.interventions.map((intervention, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <span>{intervention.action}</span>
                      <Badge variant={intervention.priority === 1 ? 'destructive' : 'secondary'}>
                        Priority {intervention.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.trajectory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Predictive Trajectory</CardTitle>
                <CardDescription>Readiness predictions 30-180 days ahead</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.trajectory.map((point, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{point.days} days</span>
                      <div className="flex items-center gap-2">
                        <Progress value={point.predictedScore} className="w-32" />
                        <span className="text-sm font-medium">{point.predictedScore}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.alignment.gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Job Alignment</CardTitle>
                <CardDescription>Match score: {data.alignment.matchScore}%</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.alignment.gaps.map((gap, idx) => (
                    <div key={idx} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                      {gap}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

