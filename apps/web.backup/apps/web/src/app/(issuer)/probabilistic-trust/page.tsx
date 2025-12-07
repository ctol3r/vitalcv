'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ProbabilisticTrustPage() {
  const [credentialId, setCredentialId] = useState('');
  const [trust, setTrust] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrust = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/probabilistic-trust/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load trust data (${response.status})`);
      }
      const data = await response.json();
      setTrust(data);
    } catch (err) {
      console.error('Failed to fetch trust', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Probabilistic Trust Engine</h1>
          <p className="text-muted-foreground">
            Computes probabilistic trust in each credential using Bayesian + ML fusion
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="Credential ID"
            className="md:w-64"
          />
          <Button onClick={fetchTrust} variant="secondary">
            Analyze
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Analyzing trust...</p>}

      {trust && trust.trustVector && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Overall Trust
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {(trust.trustVector.overall * 100).toFixed(1)}%
              </div>
              <Progress value={trust.trustVector.overall * 100} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Issuer Trust</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {(trust.trustVector.issuer * 100).toFixed(1)}%
              </div>
              <Progress value={trust.trustVector.issuer * 100} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Chain Trust</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {(trust.trustVector.chain * 100).toFixed(1)}%
              </div>
              <Progress value={trust.trustVector.chain * 100} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Evidence Trust</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {(trust.trustVector.evidence * 100).toFixed(1)}%
              </div>
              <Progress value={trust.trustVector.evidence * 100} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {trust && trust.trustVector && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Factors</CardTitle>
            <CardDescription>Detailed breakdown of trust components</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(trust.trustVector.factors || {}).map(([factor, score]: [string, any]) => (
                <div key={factor} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {factor.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <Badge variant={score > 0.7 ? 'default' : score > 0.4 ? 'secondary' : 'destructive'}>
                      {(score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={score * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {trust && trust.trustVector && trust.trustVector.overall < 0.5 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Confidence Warning</AlertTitle>
          <AlertDescription>
            This credential has low trust probability. Consider additional validation steps.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

