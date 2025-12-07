'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function WorkloadPage() {
  const [intel, setIntel] = useState<any>(null);
  const [burnoutRisk, setBurnoutRisk] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadWorkloadData();
  }, []);

  async function loadWorkloadData() {
    setLoading(true);
    try {
      const [intelRes, timelineRes] = await Promise.all([
        fetch(`${API_BASE}/api/workload-intel/${clinicianId}`),
        fetch(`${API_BASE}/api/workload-intel/${clinicianId}/timeline`),
      ]);

      if (intelRes.ok) {
        const data = await intelRes.json();
        setIntel(data);
        setBurnoutRisk(data.workload?.current?.burnoutRisk);
        setRecommendations(data.workload?.current?.recommendations || []);
      }
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.timeline || []);
      }
    } catch (error) {
      console.error('Failed to load workload data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Workload Intelligence</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Workload & Burnout Intelligence</h1>
            <p className="text-muted-foreground">
              Forecast burnout, identify overload risk, and optimize staffing for well-being
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadWorkloadData()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {burnoutRisk && (
        <Card>
          <CardHeader>
            <CardTitle>Burnout Risk Assessment</CardTitle>
            <CardDescription>Current burnout probability and risk level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Burnout Probability</span>
                <span className="font-medium">{burnoutRisk.probability}%</span>
              </div>
              <Progress
                value={burnoutRisk.probability}
                className={cn(
                  burnoutRisk.probability > 75 && 'bg-red-500',
                  burnoutRisk.probability > 50 && burnoutRisk.probability <= 75 && 'bg-amber-500'
                )}
              />
            </div>
            <Badge
              variant={
                burnoutRisk.riskLevel === 'critical'
                  ? 'destructive'
                  : burnoutRisk.riskLevel === 'high'
                    ? 'destructive'
                    : burnoutRisk.riskLevel === 'medium'
                      ? 'outline'
                      : 'default'
              }
            >
              {burnoutRisk.riskLevel.toUpperCase()} RISK
            </Badge>
            {burnoutRisk.factors?.length > 0 && (
              <div>
                <p className="font-medium mb-2">Contributing Factors:</p>
                {burnoutRisk.factors.map((factor: any, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    {factor.factor}: {factor.contribution.toFixed(1)}%
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {intel?.workload?.current?.metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Workload Metrics</CardTitle>
            <CardDescription>Current workload statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours/Week</p>
                <p className="text-2xl font-bold">{intel.workload.current.metrics.totalHours}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Shifts/Week</p>
                <p className="text-2xl font-bold">
                  {intel.workload.current.metrics.shiftsPerWeek.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Consecutive Days</p>
                <p className="text-2xl font-bold">{intel.workload.current.metrics.consecutiveDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Recommendations</CardTitle>
            <CardDescription>Suggested actions to reduce burnout risk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded border">
                <TrendingDown className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{rec.description}</span>
                    <Badge variant={rec.priority === 'high' ? 'destructive' : 'outline'}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Type: {rec.type}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Burnout Timeline</CardTitle>
            <CardDescription>Burnout probability over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeline.slice(-5).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded border">
                  <div>
                    <p className="text-sm font-medium">{new Date(entry.timestamp).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">Risk: {entry.riskLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{entry.probability}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








