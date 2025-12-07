'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CredentialReliability {
  credentialId: string;
  score: number;
  signals: {
    issuerAccuracy: number;
    evidenceConsistency: number;
    ageDecayFactor: number;
    documentIntegrity: number;
    instabilityScore: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialReliabilityPage() {
  const [reliability, setReliability] = useState<CredentialReliability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState('');

  const fetchReliability = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credentials/${credentialId}/reliability`);
      if (!response.ok) {
        throw new Error(`Failed to load reliability (${response.status})`);
      }
      const data = await response.json();
      setReliability(data);
    } catch (err) {
      console.error('Failed to fetch reliability', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500">High</Badge>;
    if (score >= 0.6) return <Badge className="bg-yellow-500">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Reliability</h1>
          <p className="text-muted-foreground">
            Measure credential trustworthiness, accuracy, consistency, and long-term behavior.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="Credential ID"
            className="md:w-64"
          />
          <Button onClick={fetchReliability} disabled={loading}>
            Analyze
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reliability && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall Reliability Score</CardTitle>
              <CardDescription>Composite score based on multiple reliability signals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <span className="text-2xl font-bold">{getScoreBadge(reliability.score)}</span>
                  <span className={`text-3xl font-bold ${getScoreColor(reliability.score)}`}>
                    {(reliability.score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={reliability.score * 100} className="h-2" />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Reliability Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Issuer Accuracy</span>
                    <span className="text-sm font-semibold">
                      {(reliability.signals.issuerAccuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={reliability.signals.issuerAccuracy * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Evidence Consistency</span>
                    <span className="text-sm font-semibold">
                      {(reliability.signals.evidenceConsistency * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={reliability.signals.evidenceConsistency * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Age Decay Factor</span>
                    <span className="text-sm font-semibold">
                      {(reliability.signals.ageDecayFactor * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={reliability.signals.ageDecayFactor * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Document Integrity</span>
                    <span className="text-sm font-semibold">
                      {(reliability.signals.documentIntegrity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={reliability.signals.documentIntegrity * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Instability Score</span>
                    <span className="text-sm font-semibold">
                      {(reliability.signals.instabilityScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={reliability.signals.instabilityScore * 100} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower is better (indicates stability)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Reliability timeline visualization would be rendered here.
                  Shows historical reliability trends for this credential.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!reliability && !loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Enter a credential ID and click Analyze to view reliability metrics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

