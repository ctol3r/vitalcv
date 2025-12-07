'use client';

import { useCallback, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityReliabilityPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-reliability/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load graph (${response.status})`);
      }
      const data = await response.json();
      setGraph(data);
    } catch (err) {
      console.error('Failed to fetch graph', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const buildGraph = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-reliability/${clinicianId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build graph (${response.status})`);
      }
      const data = await response.json();
      setGraph(data);
    } catch (err) {
      console.error('Failed to build graph', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-reliability/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Reliability snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Reliability Graph</h1>
          <p className="text-muted-foreground">
            Multi-layer graph measuring the reliability of a clinician's identity across all signals
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Identity Reliability</CardTitle>
          <CardDescription>Enter a clinician ID to view or build reliability graph</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchGraph} disabled={!clinicianId || loading}>
              View Graph
            </Button>
            <Button onClick={buildGraph} variant="outline" disabled={!clinicianId || loading}>
              Build Graph
            </Button>
            <Button onClick={anchorSnapshot} variant="outline" disabled={!clinicianId}>
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

          {graph && !loading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Reliability Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold">{graph.overallScore}</div>
                    <div className="flex-1">
                      <Progress value={graph.overallScore} className="h-2" />
                    </div>
                    <Badge variant={graph.overallScore >= 80 ? 'default' : graph.overallScore >= 60 ? 'secondary' : 'destructive'}>
                      {graph.overallScore >= 80 ? 'High' : graph.overallScore >= 60 ? 'Medium' : 'Low'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reliability Signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {graph.signals && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">DID Stability</span>
                          <span className="text-sm font-medium">{graph.signals.didStability}%</span>
                        </div>
                        <Progress value={graph.signals.didStability} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">NPI→DID Mapping</span>
                          <span className="text-sm font-medium">{graph.signals.npiDidMapping}%</span>
                        </div>
                        <Progress value={graph.signals.npiDidMapping} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Document Signals</span>
                          <span className="text-sm font-medium">{graph.signals.documentSignals}%</span>
                        </div>
                        <Progress value={graph.signals.documentSignals} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Multi-Wallet Consistency</span>
                          <span className="text-sm font-medium">{graph.signals.multiWalletConsistency}%</span>
                        </div>
                        <Progress value={graph.signals.multiWalletConsistency} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Evidence Integration</span>
                          <span className="text-sm font-medium">{graph.signals.evidenceIntegration}%</span>
                        </div>
                        <Progress value={graph.signals.evidenceIntegration} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Identity Coherence</span>
                          <span className="text-sm font-medium">{graph.signals.coherenceScore}%</span>
                        </div>
                        <Progress value={graph.signals.coherenceScore} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {graph.trajectory && graph.trajectory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reliability Trajectory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {graph.trajectory.map((point: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground w-32">
                            {new Date(point.timestamp).toLocaleDateString()}
                          </span>
                          <div className="flex-1">
                            <Progress value={point.score} />
                          </div>
                          <span className="text-sm font-medium w-16">{point.score}%</span>
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

