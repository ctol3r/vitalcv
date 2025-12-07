'use client';

import { useCallback, useState } from 'react';
import { Network, AlertTriangle, CheckCircle, TrendingUp, FileDown, RefreshCw, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityLatticePage() {
  const [clinicianId, setClinicianId] = useState('');
  const [lattice, setLattice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null);

  const fetchLattice = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load lattice (${response.status})`);
      }
      const data = await response.json();
      setLattice(data);
    } catch (err) {
      console.error('Failed to fetch lattice', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const buildLattice = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build lattice (${response.status})`);
      }
      const data = await response.json();
      setLattice(data);
    } catch (err) {
      console.error('Failed to build lattice', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const fetchRecommendations = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/recommendations`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations', err);
    }
  }, [clinicianId]);

  const fetchPredictions = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/predict?daysAhead=30`);
      if (response.ok) {
        const data = await response.json();
        setPredictions(data);
      }
    } catch (err) {
      console.error('Failed to fetch predictions', err);
    }
  }, [clinicianId]);

  const reconcileIdentity = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredSource: 'highest_trust' }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Reconciled ${data.conflicts.length} conflicts`);
        await fetchLattice();
      }
    } catch (err) {
      console.error('Failed to reconcile', err);
      alert('Failed to reconcile identity');
    } finally {
      setLoading(false);
    }
  }, [clinicianId, fetchLattice]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('Lattice snapshot anchored successfully');
      } else {
        throw new Error('Failed to anchor snapshot');
      }
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId]);

  const exportDossier = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-lattice/${clinicianId}/dossier`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `identity-lattice-dossier-${clinicianId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export dossier', err);
      alert('Failed to export dossier');
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Coherence Lattice</h1>
          <p className="text-muted-foreground">
            Measure, model, repair, and predict clinician identity coherence across every identity surface
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Identity Lattice</CardTitle>
          <CardDescription>Enter a clinician ID to view or build identity coherence lattice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchLattice} disabled={!clinicianId || loading}>
              View
            </Button>
            <Button onClick={buildLattice} disabled={!clinicianId || loading} variant="outline">
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

          {lattice && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="nodes">Nodes</TabsTrigger>
                <TabsTrigger value="edges">Edges</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="predictions">Predictions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Stability Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{lattice.stability?.toFixed(1) || 0}</div>
                      <Progress value={lattice.stability || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Entropy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{lattice.entropy?.toFixed(1) || 0}</div>
                      <Progress value={lattice.entropy || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Nodes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{lattice.nodes?.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">Identity surfaces</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2">
                  <Button onClick={reconcileIdentity} disabled={loading} variant="outline">
                    <Shield className="mr-2 h-4 w-4" />
                    Reconcile Identity
                  </Button>
                  <Button onClick={fetchRecommendations} variant="outline">
                    Load Recommendations
                  </Button>
                  <Button onClick={fetchPredictions} variant="outline">
                    Load Predictions
                  </Button>
                  <Button onClick={exportDossier} variant="outline">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Dossier
                  </Button>
                  <Button onClick={anchorSnapshot} variant="outline">
                    Anchor Snapshot
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="nodes" className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">
                  {lattice.nodes?.length || 0} identity nodes
                </div>
                <div className="space-y-2">
                  {lattice.nodes?.map((node: any, idx: number) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{node.id}</div>
                            <div className="text-sm text-muted-foreground">
                              {node.type} • {node.surface}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={node.verified ? 'default' : 'secondary'}>
                              {node.verified ? 'Verified' : 'Unverified'}
                            </Badge>
                            <Badge variant="outline">Trust: {node.trustScore?.toFixed(0)}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="edges" className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">
                  {lattice.edges?.length || 0} coherence edges
                </div>
                <div className="space-y-2">
                  {lattice.edges?.map((edge: any, idx: number) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {edge.source} → {edge.target}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Coherence: {edge.coherence?.toFixed(1)}
                            </div>
                          </div>
                          <Progress value={edge.coherence || 0} className="w-32" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-2">
                {recommendations.length === 0 ? (
                  <Alert>
                    <AlertDescription>No recommendations available. Click "Load Recommendations" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  recommendations.map((rec, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{rec.action}</div>
                            <div className="text-sm text-muted-foreground mt-1">{rec.reason}</div>
                          </div>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                            {rec.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="predictions" className="space-y-2">
                {!predictions ? (
                  <Alert>
                    <AlertDescription>No predictions available. Click "Load Predictions" to fetch.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Instability Prediction</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{predictions.instability?.toFixed(1) || 0}</div>
                        <div className="mt-4 space-y-2">
                          {predictions.factors?.map((factor: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{factor.factor}</span>
                              <span className="text-muted-foreground">{factor.impact.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








