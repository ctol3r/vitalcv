'use client';

import { useCallback, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, FileDown, RefreshCw, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OperationalIntegrityReactorPage() {
  const [orgId, setOrgId] = useState('');
  const [reactor, setReactor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drift, setDrift] = useState<any>(null);
  const [rootCauses, setRootCauses] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [optimizationPlan, setOptimizationPlan] = useState<any[]>([]);

  const fetchReactor = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load reactor (${response.status})`);
      }
      const data = await response.json();
      setReactor(data);
    } catch (err) {
      console.error('Failed to fetch reactor', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const buildReactor = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build reactor (${response.status})`);
      }
      const data = await response.json();
      setReactor(data);
    } catch (err) {
      console.error('Failed to build reactor', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchDrift = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/drift`);
      if (response.ok) {
        const data = await response.json();
        setDrift(data);
      }
    } catch (err) {
      console.error('Failed to fetch drift', err);
    }
  }, [orgId]);

  const fetchRootCauses = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/root-causes`);
      if (response.ok) {
        const data = await response.json();
        setRootCauses(data);
      }
    } catch (err) {
      console.error('Failed to fetch root causes', err);
    }
  }, [orgId]);

  const fetchPredictions = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/predict?daysAhead=30`);
      if (response.ok) {
        const data = await response.json();
        setPredictions(data);
      }
    } catch (err) {
      console.error('Failed to fetch predictions', err);
    }
  }, [orgId]);

  const fetchOptimizationPlan = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/optimization-plan`);
      if (response.ok) {
        const data = await response.json();
        setOptimizationPlan(data);
      }
    } catch (err) {
      console.error('Failed to fetch optimization plan', err);
    }
  }, [orgId]);

  const anchorSnapshot = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Reactor snapshot anchored successfully');
      } else {
        throw new Error('Failed to anchor snapshot');
      }
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [orgId]);

  const exportReport = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/op-integrity-reactor/${orgId}/export`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `op-integrity-reactor-${orgId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export report', err);
      alert('Failed to export report');
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational Integrity Reactor</h1>
          <p className="text-muted-foreground">
            Analyze employer operations as a living system: integrity, stability, reliability, compliance & fairness
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Operational Integrity Reactor</CardTitle>
          <CardDescription>Enter an organization ID to view or build operational integrity reactor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchReactor} disabled={!orgId || loading}>
              View
            </Button>
            <Button onClick={buildReactor} disabled={!orgId || loading} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Build
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {reactor && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="axes">Integrity Axes</TabsTrigger>
                <TabsTrigger value="drift">Drift Analysis</TabsTrigger>
                <TabsTrigger value="root-causes">Root Causes</TabsTrigger>
                <TabsTrigger value="predictions">Predictions</TabsTrigger>
                <TabsTrigger value="optimization">Optimization Plan</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Stability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reactor.stability?.toFixed(1) || 0}</div>
                      <Progress value={reactor.stability || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Drift</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reactor.drift?.toFixed(1) || 0}</div>
                      <Progress value={reactor.drift || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Entropy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reactor.entropy?.toFixed(1) || 0}</div>
                      <Progress value={reactor.entropy || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2">
                  <Button onClick={fetchDrift} variant="outline">
                    Analyze Drift
                  </Button>
                  <Button onClick={fetchRootCauses} variant="outline">
                    Infer Root Causes
                  </Button>
                  <Button onClick={fetchPredictions} variant="outline">
                    Predict Outcomes
                  </Button>
                  <Button onClick={fetchOptimizationPlan} variant="outline">
                    <Target className="mr-2 h-4 w-4" />
                    Optimization Plan
                  </Button>
                  <Button onClick={exportReport} variant="outline">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Report
                  </Button>
                  <Button onClick={anchorSnapshot} variant="outline">
                    Anchor Snapshot
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="axes" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reactor.axes && Object.entries(reactor.axes).map(([axis, value]: [string, any]) => (
                    <Card key={axis}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium capitalize">{axis.replace('_', ' ')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{value?.toFixed(1) || 0}</div>
                        <Progress value={value || 0} className="mt-2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="drift" className="space-y-2">
                {!drift ? (
                  <Alert>
                    <AlertDescription>No drift analysis available. Click "Analyze Drift" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Alert variant={drift.drifted ? 'destructive' : 'default'}>
                      <AlertTitle>{drift.drifted ? 'Drift Detected' : 'No Drift Detected'}</AlertTitle>
                      <AlertDescription>
                        {drift.drifted ? `${drift.breakdowns.length} operational breakdown(s) detected` : 'Operations are stable'}
                      </AlertDescription>
                    </Alert>
                    {drift.breakdowns?.map((breakdown: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{breakdown.area}</div>
                              <div className="text-sm text-muted-foreground mt-1">{breakdown.details}</div>
                            </div>
                            <Badge variant={breakdown.severity === 'high' ? 'destructive' : breakdown.severity === 'medium' ? 'default' : 'secondary'}>
                              {breakdown.severity}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="root-causes" className="space-y-2">
                {rootCauses.length === 0 ? (
                  <Alert>
                    <AlertDescription>No root causes available. Click "Infer Root Causes" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  rootCauses.map((cause, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{cause.cause}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Confidence: {(cause.confidence * 100).toFixed(0)}%
                            </div>
                            {cause.evidence && cause.evidence.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Evidence: {cause.evidence.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="predictions" className="space-y-2">
                {predictions.length === 0 ? (
                  <Alert>
                    <AlertDescription>No predictions available. Click "Predict Outcomes" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  predictions.map((pred, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{pred.event}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Probability: {pred.probability.toFixed(1)}%
                            </div>
                            {pred.factors && pred.factors.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Factors: {pred.factors.join(', ')}
                              </div>
                            )}
                          </div>
                          <Badge variant={pred.severity === 'high' ? 'destructive' : pred.severity === 'medium' ? 'default' : 'secondary'}>
                            {pred.severity}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="optimization" className="space-y-2">
                {optimizationPlan.length === 0 ? (
                  <Alert>
                    <AlertDescription>No optimization plan available. Click "Optimization Plan" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  optimizationPlan.map((action, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{action.action}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Expected Impact: {action.expectedImpact.toFixed(1)} • Effort: {action.effort} • Timeline: {action.timeline}
                            </div>
                          </div>
                          <Badge variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'default' : 'secondary'}>
                            {action.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








