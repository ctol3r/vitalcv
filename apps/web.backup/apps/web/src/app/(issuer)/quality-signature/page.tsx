'use client';

import { useCallback, useState } from 'react';
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function QualitySignaturePage() {
  const [credentialId, setCredentialId] = useState('');
  const [signature, setSignature] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignature = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-quality-signature/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load signature (${response.status})`);
      }
      const data = await response.json();
      setSignature(data.signature);
    } catch (err) {
      console.error('Failed to fetch signature', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  const generateSignature = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-quality-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (!response.ok) throw new Error('Failed to generate signature');
      const data = await response.json();
      setSignature(data.signature);
    } catch (err) {
      console.error('Failed to generate signature', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  const exportDossier = useCallback(async () => {
    if (!credentialId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-quality-signature/${credentialId}/export`);
      if (!response.ok) throw new Error('Failed to export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quality-signature-${credentialId}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export', err);
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Credential Quality Signature</h1>
        <p className="text-muted-foreground">
          Compute a unique "quality signature" for each credential — global, probabilistic, evidence-backed
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Signature</CardTitle>
          <CardDescription>Enter a credential ID to analyze or generate quality signature</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Credential ID"
              className="flex-1"
            />
            <Button onClick={fetchSignature} disabled={!credentialId || loading}>
              Load
            </Button>
            <Button onClick={generateSignature} variant="outline" disabled={!credentialId || loading}>
              Generate
            </Button>
            {signature && (
              <Button onClick={exportDossier} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Processing...</p>}

          {signature && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Reliability Score</span>
                  <Badge variant={signature.reliabilityScore >= 80 ? 'default' : signature.reliabilityScore >= 60 ? 'secondary' : 'destructive'}>
                    {signature.reliabilityScore.toFixed(1)}/100
                  </Badge>
                </div>
                <Progress value={signature.reliabilityScore} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Issuer Strength</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{signature.signals.issuerStrength}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Chain Anchor Depth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{signature.signals.chainAnchorDepth}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Temporal Freshness</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{signature.signals.temporalFreshness.toFixed(1)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Evidence Consistency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{signature.signals.evidenceConsistency}</div>
                  </CardContent>
                </Card>
              </div>

              {signature.driftDetected && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Drift Detected</AlertTitle>
                  <AlertDescription>Quality signature has drifted from historical patterns</AlertDescription>
                </Alert>
              )}

              {signature.reinforcementSuggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reinforcement Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {signature.reinforcementSuggestions.map((suggestion: string, i: number) => (
                        <li key={i} className="text-sm">{suggestion}</li>
                      ))}
                    </ul>
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

