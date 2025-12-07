'use client';

import { useCallback, useState } from 'react';
import { Building, TrendingUp, AlertTriangle, FileDown, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function WorkforceReadinessPage() {
  const [orgId, setOrgId] = useState('');
  const [index, setIndex] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIndex = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce-readiness/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load index (${response.status})`);
      }
      const data = await response.json();
      setIndex(data);
    } catch (err) {
      console.error('Failed to fetch index', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const buildIndex = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce-readiness/${orgId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build index (${response.status})`);
      }
      const data = await response.json();
      setIndex(data);
    } catch (err) {
      console.error('Failed to build index', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const anchorSnapshot = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/workforce-readiness/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Readiness snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Readiness Index</h1>
          <p className="text-muted-foreground">
            Score each employer's readiness to onboard, verify, retain, and deploy clinicians
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Workforce Readiness</CardTitle>
          <CardDescription>Enter an organization ID to view or build readiness index</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchIndex} disabled={!orgId || loading}>
              View Index
            </Button>
            <Button onClick={buildIndex} variant="outline" disabled={!orgId || loading}>
              Build Index
            </Button>
            <Button onClick={anchorSnapshot} variant="outline" disabled={!orgId}>
              <FileDown className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
            </div>
          )}

          {index && !loading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Readiness Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold">{index.score?.overall || 0}</div>
                    <div className="flex-1">
                      <Progress value={index.score?.overall || 0} className="h-2" />
                    </div>
                    <Badge variant={(index.score?.overall || 0) >= 80 ? 'default' : (index.score?.overall || 0) >= 60 ? 'secondary' : 'destructive'}>
                      {(index.score?.overall || 0) >= 80 ? 'High' : (index.score?.overall || 0) >= 60 ? 'Medium' : 'Low'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Readiness Scores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {index.score && (
                      <>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Hiring Velocity</span>
                            <span className="text-sm font-medium">{index.score.hiringVelocity}%</span>
                          </div>
                          <Progress value={index.score.hiringVelocity} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Compliance</span>
                            <span className="text-sm font-medium">{index.score.compliance}%</span>
                          </div>
                          <Progress value={index.score.compliance} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Trust</span>
                            <span className="text-sm font-medium">{index.score.trust}%</span>
                          </div>
                          <Progress value={index.score.trust} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Retention</span>
                            <span className="text-sm font-medium">{index.score.retention}%</span>
                          </div>
                          <Progress value={index.score.retention} />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Operational Readiness</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {index.operationalReadiness && (
                      <>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">ATS Integration</span>
                            <span className="text-sm font-medium">{index.operationalReadiness.atsIntegration}%</span>
                          </div>
                          <Progress value={index.operationalReadiness.atsIntegration} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Verification Speed</span>
                            <span className="text-sm font-medium">{index.operationalReadiness.verificationSpeed}%</span>
                          </div>
                          <Progress value={index.operationalReadiness.verificationSpeed} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Staffing Processes</span>
                            <span className="text-sm font-medium">{index.operationalReadiness.staffingProcesses}%</span>
                          </div>
                          <Progress value={index.operationalReadiness.staffingProcesses} />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {index.improvementPlan && index.improvementPlan.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Improvement Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {index.improvementPlan.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}>
                            {item.priority}
                          </Badge>
                          <p className="text-sm flex-1">{item.step}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {index.heatmap && (
                <Card>
                  <CardHeader>
                    <CardTitle>Multi-Facility Heatmap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(index.heatmap).map(([facility, score]: [string, any]) => (
                        <div key={facility}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">{facility}</span>
                            <span className="text-sm font-medium">{score}%</span>
                          </div>
                          <Progress value={score} />
                        </div>
                      ))}
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

