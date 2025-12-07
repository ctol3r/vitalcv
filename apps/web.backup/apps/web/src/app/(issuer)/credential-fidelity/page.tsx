'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialFidelityPage() {
  const [credentialId, setCredentialId] = useState('');
  const [fidelity, setFidelity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);

  const fetchFidelity = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-fidelity/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load fidelity (${response.status})`);
      }
      const data = await response.json();
      setFidelity(data);
    } catch (err) {
      console.error('Failed to fetch fidelity', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  const checkFalsePositive = useCallback(async () => {
    if (!credentialId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-fidelity/detect-false-positive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      const data = await response.json();
      alert(`False Positive: ${data.isFalsePositive ? 'Yes' : 'No'}`);
    } catch (err) {
      console.error('Failed to check false positive', err);
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Fidelity Engine</h1>
          <p className="text-muted-foreground">
            Measure, enforce, and predict how "faithful" each credential is to truth, evidence & reality
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check Credential Fidelity</CardTitle>
          <CardDescription>Enter a credential ID to analyze fidelity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Credential ID"
              className="flex-1"
            />
            <Button onClick={fetchFidelity} disabled={!credentialId || loading}>
              Analyze
            </Button>
            <Button onClick={checkFalsePositive} variant="outline" disabled={!credentialId}>
              Check False Positive
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Analyzing fidelity...</p>}

          {fidelity && fidelity.fidelity && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Fidelity Score</span>
                  <Badge variant={fidelity.fidelity.score >= 0.8 ? 'default' : fidelity.fidelity.score >= 0.5 ? 'secondary' : 'destructive'}>
                    {(fidelity.fidelity.score * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={fidelity.fidelity.score * 100} />
              </div>

              {fidelity.fidelity.factors && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Fidelity Factors</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Issuer Trust</span>
                        <Badge>{(fidelity.fidelity.factors.issuerTrust * 100).toFixed(0)}%</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Evidence Quality</span>
                        <Badge>{(fidelity.fidelity.factors.evidenceQuality * 100).toFixed(0)}%</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Corroboration Count</span>
                        <Badge>{fidelity.fidelity.factors.corroborationCount}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Conflict Count</span>
                        <Badge variant={fidelity.fidelity.factors.conflictCount > 0 ? 'destructive' : 'default'}>
                          {fidelity.fidelity.factors.conflictCount}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Signals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Source of Truth</span>
                        <Badge>{fidelity.fidelity.signals?.sourceOfTruth || 'Unknown'}</Badge>
                      </div>
                      {fidelity.fidelity.signals?.conflicts && fidelity.fidelity.signals.conflicts.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Conflicts:</span>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {fidelity.fidelity.signals.conflicts.map((c: any, i: number) => (
                              <li key={i}>{c.type} (severity: {c.severity})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

