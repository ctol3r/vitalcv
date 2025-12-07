'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
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

interface ReadinessData {
  readiness: number;
  predictions: Array<{ week: number; predictedScore: number; confidence: number }>;
  blockers: Array<{ type: string; severity: string; description: string }>;
  improvementPlan: Array<{ priority: string; action: string; estimatedImpact: number }>;
}

export default function ReadinessPage() {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadReadiness();
  }, []);

  async function loadReadiness() {
    setLoading(true);
    try {
      const [blockersRes, predictionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/readiness/${clinicianId}/blockers`),
        fetch(`${API_BASE}/api/readiness/${clinicianId}/predict?weeks=8`),
      ]);

      if (blockersRes.ok && predictionsRes.ok) {
        const blockers = await blockersRes.json();
        const predictions = await predictionsRes.json();
        setReadiness({
          readiness: 85, // Placeholder
          predictions: predictions.predictions || [],
          blockers: blockers.blockers || [],
          improvementPlan: [], // Would fetch separately
        });
      }
    } catch (error) {
      console.error('Failed to load readiness:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Real-World Readiness</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Real-World Readiness</h1>
            <p className="text-muted-foreground">
              Measure readiness for fast deployment in real clinical settings
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadReadiness}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {readiness && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Readiness Score</CardTitle>
              <CardDescription>Current readiness for deployment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold">{readiness.readiness}%</span>
                  <Badge variant={readiness.readiness > 80 ? 'default' : 'secondary'}>
                    {readiness.readiness > 80 ? 'Ready' : readiness.readiness > 60 ? 'Marginal' : 'Not Ready'}
                  </Badge>
                </div>
                <Progress value={readiness.readiness} />
              </div>
            </CardContent>
          </Card>

          {readiness.blockers.length > 0 && (
            <Card className="border-amber-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Readiness Blockers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {readiness.blockers.map((blocker, idx) => (
                    <li key={idx} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium">{blocker.description}</p>
                        <p className="text-sm text-muted-foreground">{blocker.type.replace('_', ' ')}</p>
                      </div>
                      <Badge variant={blocker.severity === 'high' ? 'destructive' : 'secondary'}>
                        {blocker.severity}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {readiness.predictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  8-Week Readiness Forecast
                </CardTitle>
                <CardDescription>Predicted readiness over the next 8 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-4">
                  {readiness.predictions.map((pred, idx) => (
                    <div key={idx} className="rounded border p-3 text-center">
                      <p className="text-sm text-muted-foreground">Week {pred.week}</p>
                      <p className="text-2xl font-semibold">{pred.predictedScore.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {(pred.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

