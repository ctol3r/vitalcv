'use client';

import { useCallback, useState } from 'react';
import { Zap, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ActivationPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPipeline = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/activation-pipeline/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load pipeline (${response.status})`);
      }
      const data = await response.json();
      setPipeline(data);
    } catch (err) {
      console.error('Failed to fetch pipeline', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const boostActivation = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/activation-pipeline/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId }),
      });
      const data = await response.json();
      alert(`Improvements: ${data.improvements.join(', ')}\nNew Stage: ${data.newStage}`);
      fetchPipeline();
    } catch (err) {
      console.error('Failed to boost activation', err);
    }
  }, [clinicianId, fetchPipeline]);

  const stageColors: Record<string, string> = {
    inactive: 'bg-gray-500',
    incomplete: 'bg-yellow-500',
    ready: 'bg-blue-500',
    verified: 'bg-green-500',
    deployed: 'bg-purple-500',
    retained: 'bg-indigo-500',
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activation Pipeline</h1>
          <p className="text-muted-foreground">
            Pipeline that pushes clinicians from inactive → ready → verified → deployed → retained
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Activation Pipeline</CardTitle>
          <CardDescription>Enter a clinician ID to view activation status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchPipeline} disabled={!clinicianId || loading}>
              View
            </Button>
            <Button onClick={boostActivation} variant="outline" disabled={!clinicianId}>
              <Zap className="h-4 w-4 mr-2" />
              Boost Activation
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading pipeline data...</p>}

          {pipeline && pipeline.pipeline && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Current Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge className={stageColors[pipeline.pipeline.stage] || 'bg-gray-500'}>
                      {pipeline.pipeline.stage}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {pipeline.pipeline.velocity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Velocity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Days in Stage</span>
                      <Badge>{pipeline.pipeline.velocity.daysInStage} days</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average Days</span>
                      <Badge variant="outline">{pipeline.pipeline.velocity.averageDays} days</Badge>
                    </div>
                    {pipeline.pipeline.velocity.bottlenecks && pipeline.pipeline.velocity.bottlenecks.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Bottlenecks:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {pipeline.pipeline.velocity.bottlenecks.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {pipeline.pipeline.catalysts && pipeline.pipeline.catalysts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Activation Catalysts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pipeline.pipeline.catalysts.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm">{c.action}</span>
                        <Badge variant={c.priority === 'high' ? 'default' : 'secondary'}>
                          {c.priority} priority
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {pipeline.pipeline.outcome && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Predicted Outcome</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pipeline.pipeline.outcome.predictedRole && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Predicted Role</span>
                        <Badge>{pipeline.pipeline.outcome.predictedRole}</Badge>
                      </div>
                    )}
                    {pipeline.pipeline.outcome.predictedCareUnit && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Predicted Care Unit</span>
                        <Badge>{pipeline.pipeline.outcome.predictedCareUnit}</Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Likelihood</span>
                      <Progress value={pipeline.pipeline.outcome.likelihood * 100} className="w-32" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

